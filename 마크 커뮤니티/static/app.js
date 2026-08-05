// ===== 마크 커뮤니티 프론트엔드 로직 =====

// ===== 전역 상태 =====
let currentUser = null;
let isAdmin = false;

// ===== 파티클 배경 =====
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function createParticles() {
    particles = [];
    const count = Math.min(60, Math.floor(window.innerWidth / 20));
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 3 + 1,
            speedX: (Math.random() - 0.5) * 0.5,
            speedY: (Math.random() - 0.5) * 0.5,
            color: `rgba(74, 222, 128, ${Math.random() * 0.5 + 0.1})`
        });
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0 || p.x > canvas.width) p.speedX *= -1;
        if (p.y < 0 || p.y > canvas.height) p.speedY *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
    });
    requestAnimationFrame(animateParticles);
}

resizeCanvas();
createParticles();
animateParticles();
window.addEventListener('resize', () => {
    resizeCanvas();
    createParticles();
});

// ===== 네비게이션 스크롤 효과 =====
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// ===== 리빌 애니메이션 =====
const revealElements = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });

revealElements.forEach(el => observer.observe(el));

// ===== 인증 상태 확인 =====
async function checkAuth() {
    try {
        const response = await fetch('/api/me');
        const data = await response.json();
        if (data.logged_in) {
            currentUser = data.username;
            isAdmin = data.is_admin;
            if (isAdmin) {
                document.getElementById('author').value = currentUser;
                document.getElementById('author').disabled = true;
            }
        } else {
            currentUser = null;
            isAdmin = false;
        }
    } catch (e) {
        console.error('인증 확인 실패:', e);
        currentUser = null;
        isAdmin = false;
    }
    updateAuthUI();
}

// ===== 인증 UI 업데이트 =====
function updateAuthUI() {
    const navAuth = document.getElementById('nav-auth');
    if (currentUser) {
        navAuth.innerHTML = `
            <div class="user-badge">
                👤 ${currentUser}
                ${isAdmin ? '<span class="admin-badge">관리자</span>' : ''}
            </div>
            <button class="auth-btn" onclick="handleLogout()">로그아웃</button>
        `;
    } else {
        navAuth.innerHTML = `
            <button class="auth-btn" onclick="openModal('login-modal')">로그인</button>
            <button class="auth-btn auth-btn-primary" onclick="openModal('register-modal')">회원가입</button>
        `;
    }
}

// ===== 모달 관리 =====
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function switchModal(target) {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    if (target === 'login') {
        openModal('login-modal');
    } else {
        openModal('register-modal');
    }
}

// ===== 로그인 =====
async function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!username || !password) {
        showToast('아이디와 비밀번호를 입력해주세요.', 'error');
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '로그인 실패');
        }

        currentUser = data.username;
        isAdmin = data.is_admin;
        updateAuthUI();
        closeModal('login-modal');
        showToast(data.message, 'success');

        if (isAdmin) {
            document.getElementById('author').value = currentUser;
            document.getElementById('author').disabled = true;
        }

        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        loadPosts();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ===== 회원가입 =====
async function handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const password2 = document.getElementById('register-password2').value.trim();

    if (!username || !password || !password2) {
        showToast('모든 필드를 입력해주세요.', 'error');
        return;
    }

    if (password !== password2) {
        showToast('비밀번호가 일치하지 않습니다.', 'error');
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '회원가입 실패');
        }

        currentUser = data.username;
        isAdmin = data.is_admin;
        updateAuthUI();
        closeModal('register-modal');
        showToast(data.message, 'success');

        if (isAdmin) {
            document.getElementById('author').value = currentUser;
            document.getElementById('author').disabled = true;
        }

        document.getElementById('register-username').value = '';
        document.getElementById('register-password').value = '';
        document.getElementById('register-password2').value = '';
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ===== 로그아웃 =====
async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        isAdmin = false;
        updateAuthUI();
        document.getElementById('author').value = '';
        document.getElementById('author').disabled = false;
        showToast('로그아웃되었습니다.', 'success');
        loadPosts();
    } catch (e) {
        showToast('로그아웃 실패', 'error');
    }
}

// ===== 이미지 업로드 =====
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const previewContainer = document.getElementById('preview-container');
let selectedFiles = [];

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    addFiles(files);
});

fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    addFiles(files);
    fileInput.value = '';
});

function addFiles(files) {
    files.forEach(file => {
        if (selectedFiles.length >= 10) {
            showToast('이미지는 최대 10개까지 업로드할 수 있습니다.', 'error');
            return;
        }
        selectedFiles.push(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            const item = document.createElement('div');
            item.className = 'preview-item';
            item.innerHTML = `
                <img src="${e.target.result}" alt="미리보기">
                <button class="preview-remove" data-index="${selectedFiles.length - 1}">×</button>
            `;
            previewContainer.appendChild(item);
        };
        reader.readAsDataURL(file);
    });
}

previewContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('preview-remove')) {
        const index = parseInt(e.target.dataset.index);
        selectedFiles.splice(index, 1);
        e.target.parentElement.remove();
        document.querySelectorAll('.preview-remove').forEach((btn, i) => {
            btn.dataset.index = i;
        });
    }
});

// ===== 게시글 작성 =====
const postForm = document.getElementById('post-form');

postForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('title').value.trim();
    const author = document.getElementById('author').value.trim();
    const content = document.getElementById('content').value.trim();
    const seed = document.getElementById('seed').value.trim();
    const coords = document.getElementById('coords').value.trim();
    const coordDesc = document.getElementById('coord_desc').value.trim();

    if (!title) {
        showToast('제목을 입력해주세요.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('author', author);
    formData.append('content', content);
    formData.append('seed', seed);
    formData.append('coords', coords);
    formData.append('coord_desc', coordDesc);
    selectedFiles.forEach(file => formData.append('images', file));

    const submitBtn = postForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-icon">⏳</span> 게시 중...';

    try {
        const response = await fetch('/api/posts', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || '게시글 작성에 실패했습니다.');
        }

        showToast('게시글이 성공적으로 등록되었습니다! 🎉', 'success');
        postForm.reset();
        selectedFiles = [];
        previewContainer.innerHTML = '';
        loadPosts();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="btn-icon">🚀</span> 게시하기';
    }
});

// ===== 게시글 목록 로드 =====
async function loadPosts() {
    const grid = document.getElementById('posts-grid');
    grid.innerHTML = '<div class="loading">게시글을 불러오는 중...</div>';

    try {
        const response = await fetch('/api/posts');
        const posts = await response.json();
        renderPosts(posts);
        updateStats(posts);
    } catch (error) {
        grid.innerHTML = '<div class="loading">게시글을 불러오는데 실패했습니다.</div>';
    }
}

function renderPosts(posts) {
    const grid = document.getElementById('posts-grid');

    if (posts.length === 0) {
        grid.innerHTML = `
            <div class="loading">
                <div style="font-size: 48px; margin-bottom: 16px;">🏗️</div>
                아직 게시글이 없습니다.<br>
                첫 번째 게시글을 작성해보세요!
            </div>
        `;
        return;
    }

    grid.innerHTML = posts.map((post, index) => {
        const contentHtml = formatContent(post.content);
        const seedHtml = post.seed ? `
            <div class="seed-card">
                <div class="seed-icon">🌱</div>
                <div class="seed-info">
                    <div class="seed-value">${escapeHtml(post.seed)}</div>
                    <div class="seed-label">월드 시드</div>
                </div>
            </div>
        ` : '';

        const coordHtml = post.coords ? `
            <div class="coord-card">
                <div class="coord-icon">📍</div>
                <div class="coord-info">
                    <div class="coord-value">${escapeHtml(post.coords)}</div>
                    ${post.coord_desc ? `<div class="coord-desc">${escapeHtml(post.coord_desc)}</div>` : ''}
                </div>
            </div>
        ` : '';

        const imagesHtml = post.images && post.images.length > 0 ? `
            <div class="post-images">
                ${post.images.map(img => `
                    <div class="post-image" onclick="openLightbox('${img}')">
                        <img src="${img}" alt="게시글 이미지" loading="lazy">
                    </div>
                `).join('')}
            </div>
        ` : '';

        const buttonActions = `
            <div class="admin-actions">
                ${isAdmin ? `
                    <button class="pin-btn ${post.pinned ? 'pinned' : ''}" onclick="togglePin('${post.id}')">
                        📌 ${post.pinned ? '고정 해제' : '고정'}
                    </button>
                ` : ''}
                <button class="delete-btn" onclick="deletePost('${post.id}')">🗑️ 삭제</button>
            </div>
        `;

        return `
            <div class="post-card" style="animation-delay: ${index * 0.1}s">
                <div class="post-header">
                    <h3 class="post-title">
                        ${post.pinned ? '<span class="pinned-badge">📌 고정</span>' : ''}
                        ${escapeHtml(post.title)}
                    </h3>
                </div>
                <div class="post-meta">
                    <span class="post-author">👤 ${escapeHtml(post.author)}</span>
                    <span class="post-date">🕐 ${escapeHtml(post.created_at)}</span>
                </div>
                ${contentHtml}
                ${seedHtml}
                ${coordHtml}
                ${imagesHtml}
                ${buttonActions}
            </div>
        `;
    }).join('');
}

function formatContent(content) {
    if (!content) return '';
    const lines = content.split('\n').filter(line => line.trim());
    const html = lines.map(line => {
        const trimmed = line.trim();
        const numbered = trimmed.match(/^(\d+)[\.\)]\s*(.+)/);
        if (numbered) {
            return `<p style="display: flex; gap: 8px; align-items: flex-start; margin-bottom: 8px;">
                <span style="color: var(--mc-green); font-weight: 700; min-width: 24px;">${numbered[1]}.</span>
                <span>${escapeHtml(numbered[2])}</span>
            </p>`;
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            return `<p style="display: flex; gap: 8px; align-items: flex-start; margin-bottom: 8px;">
                <span style="color: var(--mc-diamond);">▸</span>
                <span>${escapeHtml(trimmed.substring(2))}</span>
            </p>`;
        }
        return `<p style="margin-bottom: 8px;">${escapeHtml(trimmed)}</p>`;
    }).join('');
    return `<div class="post-content">${html}</div>`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== 게시글 삭제 (관리자 전용) =====
async function deletePost(postId) {
    if (!confirm('이 게시글을 삭제하시겠습니까?')) return;

    try {
        const response = await fetch(`/api/posts/${postId}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            showToast('게시글이 삭제되었습니다.', 'success');
            loadPosts();
        } else {
            const data = await response.json();
            showToast(data.error || '삭제에 실패했습니다.', 'error');
        }
    } catch (error) {
        showToast('삭제에 실패했습니다.', 'error');
    }
}

// ===== 게시글 고정 (관리자 전용) =====
async function togglePin(postId) {
    try {
        const response = await fetch(`/api/posts/${postId}/pin`, {
            method: 'POST'
        });
        if (response.ok) {
            const data = await response.json();
            showToast(data.pinned ? '게시글이 고정되었습니다. 📌' : '고정이 해제되었습니다.', 'success');
            loadPosts();
        } else {
            const data = await response.json();
            showToast(data.error || '고정에 실패했습니다.', 'error');
        }
    } catch (error) {
        showToast('고정에 실패했습니다.', 'error');
    }
}

// ===== 이미지 라이트박스 =====
function openLightbox(src) {
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `<img src="${src}" alt="이미지 확대">`;
    lightbox.addEventListener('click', () => lightbox.remove());
    document.body.appendChild(lightbox);
}

// ===== 통계 업데이트 =====
function updateStats(posts) {
    const totalPosts = posts.length;
    const totalCoords = posts.filter(p => p.coords).length;
    const totalImages = posts.reduce((sum, p) => sum + (p.images ? p.images.length : 0), 0);

    animateNumber('stat-posts', totalPosts);
    animateNumber('stat-coords', totalCoords);
    animateNumber('stat-images', totalImages);
}

function animateNumber(elementId, target) {
    const element = document.getElementById(elementId);
    const duration = 1000;
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = Math.floor(start + (target - start) * eased);
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

// ===== 토스트 알림 =====
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${type === 'success' ? '✅' : '❌'} ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// ===== 초기 로드 =====
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadPosts();
});