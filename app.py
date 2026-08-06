import os
import json
import uuid
import time
import threading
import requests
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, render_template, send_from_directory, session
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'mark-community-secret-key-2026')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
POSTS_FILE = os.path.join(DATA_DIR, 'posts.json')
USERS_FILE = os.path.join(DATA_DIR, 'users.json')

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}

# Render 배포 URL (환경변수로 설정 가능)
RENDER_URL = os.environ.get('RENDER_URL', 'https://minecraft-community-korea.onrender.com')

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ===== 데이터 로드/저장 =====
def load_posts():
    if not os.path.exists(POSTS_FILE):
        return []
    try:
        with open(POSTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def save_posts(posts):
    with open(POSTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(posts, f, ensure_ascii=False, indent=2)


def load_users():
    if not os.path.exists(USERS_FILE):
        return {}
    try:
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return {}


def save_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ===== 관리자 확인 데코레이터 =====
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('is_admin'):
            return jsonify({'error': '관리자 권한이 필요합니다.'}), 403
        return f(*args, **kwargs)
    return decorated_function


# ===== 5분마다 핑 보내기 (Render 무료 티어 sleep 방지) =====
def ping_render():
    """Render 서버가 sleep 상태로 들어가지 않도록 5분마다 HTTP 핑을 보냅니다."""
    while True:
        try:
            # 자기 자신에게 핑을 보내 서버가 sleep 상태로 들어가지 않게 함
            requests.get(RENDER_URL, timeout=10)
            print(f"[PING] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 핑 전송 완료: {RENDER_URL}")
        except Exception as e:
            print(f"[PING] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 핑 실패: {e}")
        time.sleep(300)  # 5분 대기


# 핑 스레드 시작 (항상 실행 - Render 환경이든 로컬이든)
def start_ping_thread():
    """핑 스레드를 시작합니다."""
    try:
        ping_thread = threading.Thread(target=ping_render, daemon=True)
        ping_thread.start()
        print(f"[PING] 핑 스레드가 시작되었습니다. 5분마다 {RENDER_URL}에 핑을 보냅니다.")
    except Exception as e:
        print(f"[PING] 핑 스레드 시작 실패: {e}")


# Render 환경이거나 로컬에서도 핑 스레드 시작
start_ping_thread()


# ===== 핑 엔드포인트 =====
@app.route('/ping')
def ping():
    return jsonify({'status': 'ok', 'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')})


# ===== 메인 페이지 =====
@app.route('/')
def index():
    return render_template('index.html')


# ===== 인증 API =====
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify({'error': '아이디와 비밀번호를 입력해주세요.'}), 400

    if len(username) < 2 or len(username) > 20:
        return jsonify({'error': '아이디는 2~20자 사이여야 합니다.'}), 400

    if len(password) < 4:
        return jsonify({'error': '비밀번호는 4자 이상이어야 합니다.'}), 400

    users = load_users()

    if username in users:
        return jsonify({'error': '이미 존재하는 아이디입니다.'}), 400

    # YEJUN은 관리자 계정
    is_admin = username.upper() == 'YEJUN'

    users[username] = {
        'password': generate_password_hash(password),
        'is_admin': is_admin,
        'display_name': username,
        'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    save_users(users)

    session['username'] = username
    session['display_name'] = username
    session['is_admin'] = is_admin

    return jsonify({
        'success': True,
        'username': username,
        'display_name': username,
        'is_admin': is_admin,
        'message': '관리자 계정으로 가입되었습니다!' if is_admin else '회원가입이 완료되었습니다!'
    }), 201


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify({'error': '아이디와 비밀번호를 입력해주세요.'}), 400

    users = load_users()

    # YEJUN 계정이 없으면 자동 생성 (관리자)
    if username.upper() == 'YEJUN' and username not in users:
        users[username] = {
            'password': generate_password_hash(password),
            'is_admin': True,
            'display_name': username,
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        save_users(users)

    if username not in users:
        return jsonify({'error': '존재하지 않는 아이디입니다.'}), 401

    user = users[username]

    if not user.get('password') or not check_password_hash(user['password'], password):
        return jsonify({'error': '비밀번호가 올바르지 않습니다.'}), 401

    session['username'] = username
    session['display_name'] = username
    session['is_admin'] = user.get('is_admin', False)

    return jsonify({
        'success': True,
        'username': username,
        'display_name': username,
        'is_admin': user.get('is_admin', False),
        'message': '관리자로 로그인되었습니다!' if user.get('is_admin') else '로그인되었습니다!'
    })


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})


@app.route('/api/me', methods=['GET'])
def get_me():
    if not session.get('username'):
        return jsonify({'logged_in': False})
    return jsonify({
        'logged_in': True,
        'username': session['username'],
        'display_name': session.get('display_name', session['username']),
        'is_admin': session.get('is_admin', False)
    })


# ===== 게시글 API =====
@app.route('/api/posts', methods=['GET'])
def get_posts():
    posts = load_posts()
    # 고정 게시글 먼저, 그 다음 최신순
    posts.sort(key=lambda p: (not p.get('pinned', False), p.get('created_at', '')), reverse=True)
    return jsonify(posts)


@app.route('/api/posts', methods=['POST'])
def create_post():
    data = request.form
    title = data.get('title', '').strip()
    author = data.get('author', '').strip() or '익명'
    content = data.get('content', '').strip()
    seed = data.get('seed', '').strip()
    coords = data.get('coords', '').strip()
    coord_desc = data.get('coord_desc', '').strip()

    if not title:
        return jsonify({'error': '제목을 입력해주세요.'}), 400

    # 로그인한 사용자는 닉네임 자동 설정
    if session.get('username'):
        author = session.get('display_name', session['username'])

    # 이미지 업로드 처리
    images = []
    files = request.files.getlist('images')
    for file in files:
        if file and file.filename and allowed_file(file.filename):
            ext = file.filename.rsplit('.', 1)[1].lower()
            filename = f"{uuid.uuid4().hex}.{ext}"
            file.save(os.path.join(UPLOAD_DIR, filename))
            images.append(f"/uploads/{filename}")

    post = {
        'id': uuid.uuid4().hex,
        'title': title,
        'author': author,
        'content': content,
        'seed': seed,
        'coords': coords,
        'coord_desc': coord_desc,
        'images': images,
        'pinned': False,
        'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'timestamp': time.time()
    }

    posts = load_posts()
    posts.append(post)
    save_posts(posts)

    return jsonify(post), 201


@app.route('/api/posts/<post_id>', methods=['DELETE'])
def delete_post(post_id):
    posts = load_posts()
    posts = [p for p in posts if p.get('id') != post_id]
    save_posts(posts)
    return jsonify({'success': True})


@app.route('/api/posts/<post_id>/pin', methods=['POST'])
@admin_required
def pin_post(post_id):
    posts = load_posts()
    for post in posts:
        if post.get('id') == post_id:
            post['pinned'] = not post.get('pinned', False)
            save_posts(posts)
            return jsonify({'success': True, 'pinned': post['pinned']})
    return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404


@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename)


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
