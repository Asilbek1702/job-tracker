// Configuration
const API_URL = 'https://job-tracker-api.onrender.com';
let token = localStorage.getItem('token');
let userType = localStorage.getItem('userType');
let currentEditJobId = null;
let currentTab = 'resume';

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        showMainSection();
        loadUserInfo();
        loadJobs();
        loadAnalytics();
    }
});

// Utility functions
function showError(sectionId, message) {
    const errorDiv = document.getElementById(sectionId + 'Error');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    setTimeout(() => errorDiv.classList.add('hidden'), 5000);
}

function showSuccess(message) {
    const successDiv = document.getElementById('mainSuccess');
    successDiv.textContent = message;
    successDiv.classList.remove('hidden');
    setTimeout(() => successDiv.classList.add('hidden'), 3000);
}

function showMainSection() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('mainSection').classList.remove('hidden');
}

function showAuthSection() {
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('mainSection').classList.add('hidden');
}

// Authentication functions
async function register() {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const user_type = document.getElementById('userType').value;

    if (!email || !password) {
        showError('auth', 'Заполните все поля');
        return;
    }

    if (password.length < 6) {
        showError('auth', 'Пароль должен быть минимум 6 символов');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, user_type })
        });

        const data = await response.json();
        if (response.ok) {
            token = data.access_token;
            userType = data.user_type;
            localStorage.setItem('token', token);
            localStorage.setItem('userType', userType);
            showMainSection();
            loadUserInfo();
            loadJobs();
            loadAnalytics();
            clearAuthForm();
        } else {
            showError('auth', data.detail || 'Ошибка регистрации');
        }
    } catch (error) {
        showError('auth', 'Не удалось подключиться к серверу. Убедитесь, что сервер запущен.');
    }
}

async function login() {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;

    if (!email || !password) {
        showError('auth', 'Заполните все поля');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (response.ok) {
            token = data.access_token;
            userType = data.user_type;
            localStorage.setItem('token', token);
            localStorage.setItem('userType', userType);
            showMainSection();
            loadUserInfo();
            loadJobs();
            loadAnalytics();
            clearAuthForm();
        } else {
            showError('auth', data.detail || 'Неверный email или пароль');
        }
    } catch (error) {
        showError('auth', 'Не удалось подключиться к серверу. Убедитесь, что сервер запущен.');
    }
}

function logout() {
    token = null;
    userType = null;
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    showAuthSection();
    clearAuthForm();
}

function clearAuthForm() {
    document.getElementById('authEmail').value = '';
    document.getElementById('authPassword').value = '';
    document.getElementById('userType').value = 'job_seeker';
}

async function loadUserInfo() {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const user = await response.json();
            userType = user.user_type;
            localStorage.setItem('userType', userType);
            
            const userTypeDisplay = document.getElementById('userTypeDisplay');
            const typeText = userType === 'job_seeker' ? '👤 Ищу работу' : '💼 Работодатель';
            userTypeDisplay.textContent = typeText;
            userTypeDisplay.className = `user-type-badge user-type-${userType}`;
            
            // Обновляем интерфейс в зависимости от роли
            updateUIForUserType(userType);
        }
    } catch (error) {
        console.error('Failed to load user info', error);
    }
}

function updateUIForUserType(type) {
    if (type === 'job_seeker') {
        // Показываем вкладки для соискателя
        document.getElementById('jobSeekerTabs').classList.remove('hidden');
        document.getElementById('employerContent').classList.add('hidden');
        
        // Показываем первую вкладку (резюме) по умолчанию
        switchTab('resume');
        
        // Активируем первую кнопку
        const firstTab = document.querySelector('.tab-btn');
        if (firstTab) {
            firstTab.classList.add('active');
        }
        
        loadResume();
        
        document.getElementById('mainTitle').textContent = 'Поиск работы';
        
        // Обновляем текст формы для соискателя
        const formTitle = document.getElementById('formTitle');
        const addButton = document.getElementById('addButton');
        if (formTitle) formTitle.textContent = 'Добавить отклик на вакансию';
        if (addButton) addButton.textContent = 'Добавить отклик';
        
    } else if (type === 'employer') {
        // Скрываем вкладки для работодателя
        document.getElementById('jobSeekerTabs').classList.add('hidden');
        
        // Скрываем все вкладки соискателя
        document.getElementById('resumeTab').classList.add('hidden');
        document.getElementById('applicationsTab').classList.add('hidden');
        document.getElementById('vacanciesTab').classList.add('hidden');
        document.getElementById('historyTab').classList.add('hidden');
        
        // Показываем контент работодателя
        document.getElementById('employerContent').classList.remove('hidden');
        
        document.getElementById('mainTitle').textContent = 'Мои вакансии';
        
        // Загружаем данные работодателя
        loadJobs();
        loadAnalytics();
    }
}

function updateEmployerElements() {
    // Используем альтернативные элементы для работодателя
    const stats = ['totalJobs2', 'interviewJobs2', 'offerJobs2', 'interviewRate2'];
    document.getElementById('totalJobs2').textContent = document.getElementById('totalJobs').textContent || '0';
    document.getElementById('interviewJobs2').textContent = document.getElementById('interviewJobs').textContent || '0';
    document.getElementById('offerJobs2').textContent = document.getElementById('offerJobs').textContent || '0';
    document.getElementById('interviewRate2').textContent = document.getElementById('interviewRate').textContent || '0%';
}

// Tab switching
function switchTab(tabName) {
    currentTab = tabName;
    
    // Убираем активный класс со всех кнопок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Активируем кнопку которую нажали
    event?.target?.classList.add('active');
    
    // Скрываем все вкладки
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Показываем нужную вкладку
    const tabs = {
        'resume': 'resumeTab',
        'applications': 'applicationsTab',
        'vacancies': 'vacanciesTab',
        'history': 'historyTab'
    };
    
    if (tabs[tabName]) {
        document.getElementById(tabs[tabName]).classList.remove('hidden');
        
        // Загружаем данные для вкладки
        if (tabName === 'applications') {
            loadJobs();
            loadAnalytics();
        } else if (tabName === 'history') {
            loadHistory();
        } else if (tabName === 'resume') {
            loadResume();
        }
    }
}

// Resume functions
function loadResume() {
    const resume = JSON.parse(localStorage.getItem('resume') || '{}');
    
    document.getElementById('resumeName').value = resume.name || '';
    document.getElementById('resumeEmail').value = resume.email || '';
    document.getElementById('resumePhone').value = resume.phone || '';
    document.getElementById('resumePosition').value = resume.position || '';
    document.getElementById('resumeExperience').value = resume.experience || '';
    document.getElementById('resumeSkills').value = resume.skills || '';
    document.getElementById('resumeEducation').value = resume.education || '';
    document.getElementById('resumeAbout').value = resume.about || '';
}

function saveResume() {
    const resume = {
        name: document.getElementById('resumeName').value.trim(),
        email: document.getElementById('resumeEmail').value.trim(),
        phone: document.getElementById('resumePhone').value.trim(),
        position: document.getElementById('resumePosition').value.trim(),
        experience: document.getElementById('resumeExperience').value.trim(),
        skills: document.getElementById('resumeSkills').value.trim(),
        education: document.getElementById('resumeEducation').value.trim(),
        about: document.getElementById('resumeAbout').value.trim(),
        updated_at: new Date().toISOString()
    };
    
    localStorage.setItem('resume', JSON.stringify(resume));
    showSuccess('Резюме успешно сохранено!');
}

function loadHistory() {
    const historyTimeline = document.getElementById('historyTimeline');
    
    // Получаем все вакансии и создаём историю
    fetch(`${API_URL}/jobs`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(jobs => {
        if (jobs.length === 0) {
            historyTimeline.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 64px; margin-bottom: 20px;">📋</div>
                    <h3 style="color: #666; margin-bottom: 10px;">История откликов пуста</h3>
                    <p style="color: #999;">Начните добавлять отклики на вкладке "Мои отклики"</p>
                </div>
            `;
            return;
        }
        
        // Сортируем по дате обновления
        jobs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        
        historyTimeline.innerHTML = jobs.map(job => `
            <div class="timeline-item">
                <div class="timeline-date">${formatDate(job.updated_at)}</div>
                <div class="timeline-content">
                    <strong>${escapeHtml(job.position)}</strong> в ${escapeHtml(job.company_name)}
                    <br>
                    <span class="status-badge status-${job.status}" style="margin-top: 8px; display: inline-block;">
                        ${job.status}
                    </span>
                    ${job.notes ? `<p style="color: #666; margin-top: 8px; font-size: 14px;">${escapeHtml(job.notes)}</p>` : ''}
                </div>
            </div>
        `).join('');
    })
    .catch(error => {
        console.error('Failed to load history', error);
        historyTimeline.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #e53e3e;">
                <p>Не удалось загрузить историю</p>
            </div>
        `;
    });
}

function searchVacancies() {
    // Заглушка для поиска вакансий
    console.log('Searching vacancies...');
}

// Export functions
async function exportToCSV() {
    try {
        const response = await fetch(`${API_URL}/export/csv`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `job_tracker_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showSuccess('Данные экспортированы в CSV!');
        } else {
            showError('main', 'Не удалось экспортировать данные');
        }
    } catch (error) {
        showError('main', 'Ошибка экспорта');
    }
}

// Analytics functions
async function loadAnalytics() {
    try {
        const response = await fetch(`${API_URL}/analytics/summary`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            
            // Обновляем статистику для обеих ролей
            if (document.getElementById('totalJobs')) {
                document.getElementById('totalJobs').textContent = data.total_jobs;
                document.getElementById('interviewJobs').textContent = data.interview;
                document.getElementById('offerJobs').textContent = data.offer;
                document.getElementById('interviewRate').textContent = data.interview_rate + '%';
            }
            
            if (document.getElementById('totalJobs2')) {
                document.getElementById('totalJobs2').textContent = data.total_jobs;
                document.getElementById('interviewJobs2').textContent = data.interview;
                document.getElementById('offerJobs2').textContent = data.offer;
                document.getElementById('interviewRate2').textContent = data.interview_rate + '%';
            }
        } else if (response.status === 401) {
            logout();
        }
    } catch (error) {
        console.error('Failed to load analytics', error);
    }
}

// Jobs functions
async function loadJobs() {
    // Для работодателя используем другие элементы
    const isEmployer = userType === 'employer';
    const statusId = isEmployer ? 'filterStatus2' : 'filterStatus';
    const companyId = isEmployer ? 'filterCompany2' : 'filterCompany';
    
    const status = document.getElementById(statusId)?.value || '';
    const company = document.getElementById(companyId)?.value || '';

    let url = `${API_URL}/jobs?`;
    if (status) url += `status=${status}&`;
    if (company) url += `company=${encodeURIComponent(company)}&`;

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const jobs = await response.json();
            displayJobs(jobs);
        } else if (response.status === 401) {
            logout();
        } else {
            showError('main', 'Не удалось загрузить вакансии');
        }
    } catch (error) {
        showError('main', 'Не удалось подключиться к серверу');
    }
}

function displayJobs(jobs) {
    const isEmployer = userType === 'employer';
    const jobsListId = isEmployer ? 'jobsList2' : 'jobsList';
    const jobsList = document.getElementById(jobsListId);
    
    if (!jobsList) return;
    
    if (jobs.length === 0) {
        const emptyText = isEmployer 
            ? 'Нет вакансий. Добавьте первую вакансию!' 
            : 'Нет откликов. Добавьте первый отклик!';
        jobsList.innerHTML = `<p style="text-align: center; color: #666; padding: 40px;">${emptyText}</p>`;
        return;
    }

    jobsList.innerHTML = jobs.map(job => {
        // Меняем отображение для работодателя
        let displayTitle, displayCompany;
        
        if (isEmployer) {
            // Для работодателя: company_name = название вакансии, position = имя кандидата
            displayTitle = job.company_name; // Название вакансии
            displayCompany = job.position || 'Кандидат'; // Имя кандидата (если указано)
        } else {
            // Для соискателя: company_name = компания, position = должность
            displayTitle = job.position; // Должность
            displayCompany = job.company_name; // Компания
        }
        
        // Меняем текст статусов для работодателя
        let statusText = job.status;
        if (isEmployer) {
            const statusMap = {
                'Applied': 'Новый отклик',
                'Interview': 'Назначено интервью',
                'Offer': 'Отправлен оффер',
                'Rejected': 'Отказ'
            };
            statusText = statusMap[job.status] || job.status;
        }
        
        return `
        <div class="job-card">
            <div class="job-header">
                <div>
                    <div class="job-title">${escapeHtml(displayTitle)}</div>
                    <div class="job-company">${escapeHtml(displayCompany)}</div>
                </div>
                <span class="status-badge status-${job.status}">${statusText}</span>
            </div>
            <div class="job-details">
                ${job.salary ? `<p>💰 ${escapeHtml(job.salary)}</p>` : ''}
                ${job.link ? `<p>🔗 <a href="${escapeHtml(job.link)}" target="_blank" rel="noopener noreferrer">Ссылка</a></p>` : ''}
                ${job.notes ? `<p>📝 ${escapeHtml(job.notes)}</p>` : ''}
                <p style="color: #999; font-size: 12px; margin-top: 8px;">
                    Добавлено: ${formatDate(job.created_at)}
                    ${job.updated_at !== job.created_at ? ` • Обновлено: ${formatDate(job.updated_at)}` : ''}
                </p>
            </div>
            <div class="job-actions">
                <button class="btn btn-edit" onclick="openEditModal(${job.id})">Редактировать</button>
                <button class="btn btn-danger" onclick="deleteJob(${job.id})">Удалить</button>
            </div>
        </div>
    `;
    }).join('');
}

async function addJob() {
    const isEmployer = userType === 'employer';
    
    // Используем правильные ID в зависимости от роли
    const companyId = isEmployer ? 'newCompany2' : 'newCompany';
    const positionId = isEmployer ? 'newPosition2' : 'newPosition';
    const statusId = isEmployer ? 'newStatus2' : 'newStatus';
    const salaryId = isEmployer ? 'newSalary2' : 'newSalary';
    const linkId = isEmployer ? 'newLink2' : 'newLink';
    const notesId = isEmployer ? 'newNotes2' : 'newNotes';
    
    const companyField = document.getElementById(companyId);
    const positionField = document.getElementById(positionId);
    const statusField = document.getElementById(statusId);
    const salaryField = document.getElementById(salaryId);
    const linkField = document.getElementById(linkId);
    const notesField = document.getElementById(notesId);
    
    // Проверяем что поля существуют
    if (!companyField || !positionField) {
        showError('main', 'Ошибка: форма не найдена');
        return;
    }
    
    const job = {
        company_name: companyField.value.trim(),
        position: positionField.value.trim() || 'Кандидат', // Для работодателя позиция опциональна
        status: statusField.value,
        salary: salaryField.value.trim() || null,
        link: linkField.value.trim() || null,
        notes: notesField.value.trim() || null
    };

    const companyFieldName = isEmployer ? 'название вакансии' : 'название компании';

    if (!job.company_name) {
        showError('main', `Заполните ${companyFieldName}`);
        return;
    }
    
    // Для соискателя должность обязательна
    if (!isEmployer && !job.position) {
        showError('main', 'Заполните должность');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/jobs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(job)
        });

        if (response.ok) {
            // Очищаем форму
            companyField.value = '';
            positionField.value = '';
            salaryField.value = '';
            linkField.value = '';
            notesField.value = '';
            
            const successMessage = isEmployer 
                ? 'Вакансия успешно добавлена!' 
                : 'Отклик успешно добавлен!';
            showSuccess(successMessage);
            loadJobs();
            loadAnalytics();
        } else if (response.status === 401) {
            logout();
        } else {
            const data = await response.json();
            showError('main', data.detail || 'Не удалось добавить запись');
        }
    } catch (error) {
        showError('main', 'Ошибка подключения к серверу');
    }
}

async function deleteJob(jobId) {
    const isEmployer = userType === 'employer';
    const confirmMessage = isEmployer 
        ? 'Вы уверены, что хотите удалить этого кандидата?' 
        : 'Вы уверены, что хотите удалить эту вакансию?';
    
    if (!confirm(confirmMessage)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/jobs/${jobId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok || response.status === 204) {
            const successMessage = isEmployer ? 'Кандидат удалён' : 'Вакансия удалена';
            showSuccess(successMessage);
            loadJobs();
            loadAnalytics();
        } else if (response.status === 401) {
            logout();
        } else if (response.status === 404) {
            showError('main', 'Запись не найдена');
        } else {
            showError('main', 'Не удалось удалить запись');
        }
    } catch (error) {
        showError('main', 'Ошибка подключения к серверу');
    }
}

// Edit modal functions
async function openEditModal(jobId) {
    currentEditJobId = jobId;
    
    try {
        const response = await fetch(`${API_URL}/jobs/${jobId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const job = await response.json();
            
            document.getElementById('editCompany').value = job.company_name;
            document.getElementById('editPosition').value = job.position;
            document.getElementById('editStatus').value = job.status;
            document.getElementById('editSalary').value = job.salary || '';
            document.getElementById('editLink').value = job.link || '';
            document.getElementById('editNotes').value = job.notes || '';
            
            document.getElementById('editModal').classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } else {
            showError('main', 'Не удалось загрузить данные вакансии');
        }
    } catch (error) {
        showError('main', 'Ошибка подключения к серверу');
    }
}

function closeEditModal() {
    document.getElementById('editModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
    currentEditJobId = null;
}

async function saveEditJob() {
    if (!currentEditJobId) return;

    const isEmployer = userType === 'employer';
    const job = {
        company_name: document.getElementById('editCompany').value.trim(),
        position: document.getElementById('editPosition').value.trim(),
        status: document.getElementById('editStatus').value,
        salary: document.getElementById('editSalary').value.trim() || null,
        link: document.getElementById('editLink').value.trim() || null,
        notes: document.getElementById('editNotes').value.trim() || null
    };

    const companyFieldName = isEmployer ? 'имя кандидата' : 'название компании';
    const positionFieldName = isEmployer ? 'вакансию' : 'должность';

    if (!job.company_name || !job.position) {
        alert(`Заполните ${companyFieldName} и ${positionFieldName}`);
        return;
    }

    try {
        const response = await fetch(`${API_URL}/jobs/${currentEditJobId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(job)
        });

        if (response.ok) {
            closeEditModal();
            const successMessage = isEmployer 
                ? 'Кандидат успешно обновлён!' 
                : 'Вакансия успешно обновлена!';
            showSuccess(successMessage);
            loadJobs();
            loadAnalytics();
        } else if (response.status === 401) {
            logout();
        } else {
            const data = await response.json();
            alert(data.detail || 'Не удалось обновить запись');
        }
    } catch (error) {
        alert('Ошибка подключения к серверу');
    }
}

function clearJobForm() {
    document.getElementById('newCompany').value = '';
    document.getElementById('newPosition').value = '';
    document.getElementById('newStatus').value = 'Applied';
    document.getElementById('newSalary').value = '';
    document.getElementById('newLink').value = '';
    document.getElementById('newNotes').value = '';
}

// Utility helpers
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Escape to close modal
    if (e.key === 'Escape') {
        const modal = document.getElementById('editModal');
        if (!modal.classList.contains('hidden')) {
            closeEditModal();
        }
    }
    
    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const authSection = document.getElementById('authSection');
        if (!authSection.classList.contains('hidden')) {
            document.getElementById('authEmail').focus();
        } else {
            document.getElementById('filterCompany').focus();
        }
    }
});

// Close modal when clicking outside
document.getElementById('editModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'editModal') {
        closeEditModal();
    }
});