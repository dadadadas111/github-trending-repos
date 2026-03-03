// script.js

const API_BASE_URL = 'https://githubtrending.lessx.xyz/trending';

// DOM Elements
const repoGrid = document.getElementById('repo-grid');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const emptyState = document.getElementById('empty-state');
const skeletonGrid = document.querySelector('.skeleton-grid');
const timeFilters = document.querySelectorAll('.filter-btn');
const langFilter = document.getElementById('language-filter');
const searchInput = document.getElementById('search-input');
const totalCount = document.getElementById('total-count');
const retryBtn = document.getElementById('retry-btn');
const clearFiltersBtn = document.getElementById('clear-filters-btn');

// State
let state = {
    currentTime: 'daily', // daily, weekly, monthly
    currentLang: 'all',
    searchQuery: '',
    data: {
        daily: null,
        weekly: null,
        monthly: null
    }
};

// Initialize Skeletons
function initSkeletons() {
    let skeletonsHTML = '';
    for(let i=0; i<9; i++) {
        skeletonsHTML += `<div class="skeleton-card"></div>`;
    }
    skeletonGrid.innerHTML = skeletonsHTML;
}

// Fetch Data
async function fetchTrendingData(since = 'daily') {
    // Check cache first
    if (state.data[since]) {
        return state.data[since];
    }

    const targetUrl = `${API_BASE_URL}?since=${since}`;
    const proxyUrls = [
        `https://api.codetabs.com/v1/proxy?quest=${targetUrl}`,
        targetUrl // direct attempt as last resort
    ];

    let lastError;
    for (const url of proxyUrls) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            const data = await response.json();
            state.data[since] = data;
            return data;
        } catch (error) {
            lastError = error;
            console.warn(`Proxy failed (${url}):`, error.message);
        }
    }

    console.error('All fetch attempts failed:', lastError);
    throw lastError;
}

// Extract and Populate Languages
function populateLanguages(data) {
    const langs = new Set();
    data.forEach(repo => {
        if (repo.language) {
            langs.add(repo.language);
        }
    });
    
    // Sort alphabetically
    const sortedLangs = Array.from(langs).sort();
    
    // Save current selected language if it exists in the new list
    const currentSelected = langFilter.value;
    
    // Build options
    let optionsHTML = `<option value="all">All Languages</option>`;
    sortedLangs.forEach(lang => {
        optionsHTML += `<option value="${lang}">${lang}</option>`;
    });
    
    langFilter.innerHTML = optionsHTML;
    
    // Restore selection or default to 'all'
    if (sortedLangs.includes(currentSelected)) {
        langFilter.value = currentSelected;
        state.currentLang = currentSelected;
    } else {
        langFilter.value = 'all';
        state.currentLang = 'all';
    }
}

// Filter Data
function filterData(data) {
    if (!data || !Array.isArray(data)) return [];
    
    return data.filter(repo => {
        // Filter by language
        const matchLang = state.currentLang === 'all' || repo.language === state.currentLang;
        
        // Filter by search query
        const query = state.searchQuery.toLowerCase().trim();
        const matchSearch = query === '' || 
            (repo.name && repo.name.toLowerCase().includes(query)) || 
            (repo.description && repo.description.toLowerCase().includes(query));
            
        return matchLang && matchSearch;
    });
}

// Render Cards
function renderCards(filteredData) {
    repoGrid.innerHTML = '';
    
    if (filteredData.length === 0) {
        showState('empty');
        totalCount.textContent = '0';
        return;
    }
    
    showState('grid');
    totalCount.textContent = filteredData.length;
    
    filteredData.forEach((repo, index) => {
        const card = document.createElement('article');
        card.className = 'repo-card';
        card.href = repo.repository ? `https://github.com${repo.repository}` : '#';
        if(card.href !== '#') {
            card.target = '_blank';
            card.rel = 'noopener noreferrer';
        }
        
        // Handle potentially missing data safely
        const name = repo.name || 'Unknown Repository';
        const owner = repo.repository ? repo.repository.split('/')[1] : 'Unknown';
        const repoName = repo.repository ? repo.repository.split('/')[2] : name;
        const desc = repo.description || 'No description provided for this repository.';
        const lang = repo.language || 'Unknown';
        const langColor = getLangColor(lang);
        const stars = formatNumber(repo.stars || 0);
        const forks = formatNumber(repo.forks || 0);
        const increase = formatNumber(repo.increased || 0);
        
        // Top 3 ranking classes
        const rankClass = index < 3 ? `rank-${index + 1}` : '';
        const rankNum = index + 1;
        
        // Builders HTML
        let buildersHTML = '';
        if (repo.builders && repo.builders.length > 0) {
            const maxBuilders = 5;
            const shownBuilders = repo.builders.slice(0, maxBuilders);
            
            let avatars = shownBuilders.map(b => {
                if(b.avatar) {
                    return `<img src="${b.avatar}" alt="${b.username}" class="avatar" title="${b.username}" loading="lazy" onerror="this.style.display='none'">`;
                }
                return '';
            }).join('');
            
            if (repo.builders.length > maxBuilders) {
                avatars += `<div class="avatar" style="display:flex;align-items:center;justify-content:center;font-size:0.6rem;background:var(--bg-secondary);color:var(--text-secondary);border:1px solid var(--glass-border)">+${repo.builders.length - maxBuilders}</div>`;
            }
            
            buildersHTML = `
                <div class="builders">
                    <span class="builders-label">Built by</span>
                    <div class="avatars">${avatars}</div>
                </div>
            `;
        }

        // Card HTML Structure using anchor wrapping instead of div
        const cardInner = `
            <div class="card-header">
                <div class="repo-title-group">
                    <div class="rank-badge ${rankClass}">${rankNum}</div>
                    <div class="repo-name">
                        <span class="repo-owner">${owner} /</span> ${repoName}
                    </div>
                </div>
            </div>
            
            <p class="repo-desc">${desc}</p>
            
            ${buildersHTML}
            
            <div class="card-meta">
                <div class="meta-item meta-lang">
                    <span class="lang-dot" style="background-color: ${langColor}"></span>
                    ${lang}
                </div>
                <div class="meta-item meta-stars">
                    <i class="ph ph-star-fill"></i> ${stars}
                </div>
                <div class="meta-item meta-forks">
                    <i class="ph ph-git-fork"></i> ${forks}
                </div>
                <div class="meta-item meta-increase">
                    <i class="ph ph-trend-up"></i> ${increase} ${getTimePeriodLabel()}
                </div>
            </div>
        `;
        
        // If we have a valid link, make the whole card clickable properly
        if (repo.repository) {
            // Need to change article to a for valid HTML with internal divs
            const aCard = document.createElement('a');
            aCard.className = 'repo-card';
            aCard.href = `https://github.com${repo.repository}`;
            aCard.target = '_blank';
            aCard.rel = 'noopener noreferrer';
            aCard.innerHTML = cardInner;
            
            // Stagger animation
            aCard.style.transitionDelay = `${(index % 10) * 0.05}s`;
            
            repoGrid.appendChild(aCard);
            
            // Trigger animation frame after append
            requestAnimationFrame(() => {
                aCard.classList.add('animate-in');
            });
        } else {
            card.innerHTML = cardInner;
            card.style.transitionDelay = `${(index % 10) * 0.05}s`;
            repoGrid.appendChild(card);
            
            requestAnimationFrame(() => {
                card.classList.add('animate-in');
            });
        }
    });
}

// UI State Management
function showState(stateName) {
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    emptyState.classList.add('hidden');
    repoGrid.classList.add('hidden');
    
    switch(stateName) {
        case 'loading':
            loadingState.classList.remove('hidden');
            break;
        case 'error':
            errorState.classList.remove('hidden');
            break;
        case 'empty':
            emptyState.classList.remove('hidden');
            break;
        case 'grid':
            repoGrid.classList.remove('hidden');
            break;
    }
}

// Main Flow Function
async function updateDashboard() {
    showState('loading');
    
    try {
        const data = await fetchTrendingData(state.currentTime);
        
        // Only repopulate languages if time filter changed (not on search/lang change)
        populateLanguages(data);
        
        const filteredData = filterData(data);
        renderCards(filteredData);
    } catch (error) {
        showState('error');
    }
}

// Utility: Debounce
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// Utility: Format Numbers (e.g. 1500 -> 1.5k)
function formatNumber(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}

// Utility: Get time period label for "increased" metric
function getTimePeriodLabel() {
    const labels = { daily: 'today', weekly: 'this week', monthly: 'this month' };
    return labels[state.currentTime] || 'today';
}

// Utility: Simple deterministic colors for languages based on string hash
function getLangColor(lang) {
    if (lang === 'Unknown') return 'var(--text-muted)';
    
    // Some common exact matches
    const commonColors = {
        'JavaScript': '#f1e05a',
        'TypeScript': '#3178c6',
        'Python': '#3572A5',
        'Java': '#b07219',
        'Go': '#00ADD8',
        'C++': '#f34b7d',
        'Ruby': '#701516',
        'Rust': '#dea584',
        'HTML': '#e34c26',
        'CSS': '#563d7c',
        'Shell': '#89e051',
        'Vue': '#41b883',
        'C': '#555555',
        'C#': '#178600'
    };
    
    if (commonColors[lang]) return commonColors[lang];
    
    // Generate color from hash
    let hash = 0;
    for (let i = 0; i < lang.length; i++) {
        hash = lang.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Constrain to slightly vibrant colors
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 65%)`;
}

// Event Listeners
timeFilters.forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Update active class
        timeFilters.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        // Update state and refresh
        state.currentTime = e.target.dataset.time;
        updateDashboard();
    });
});

langFilter.addEventListener('change', (e) => {
    state.currentLang = e.target.value;
    
    // We already have the data locally, so just re-filter and render
    if (state.data[state.currentTime]) {
        const filteredData = filterData(state.data[state.currentTime]);
        renderCards(filteredData);
    }
});

const handleSearch = debounce((e) => {
    state.searchQuery = e.target.value;
    
    // We already have the data locally, so just re-filter and render
    if (state.data[state.currentTime]) {
        const filteredData = filterData(state.data[state.currentTime]);
        renderCards(filteredData);
    }
}, 300);

searchInput.addEventListener('input', handleSearch);

retryBtn.addEventListener('click', () => {
    // Clear cache for current time to force fresh fetch
    state.data[state.currentTime] = null;
    updateDashboard();
});

clearFiltersBtn.addEventListener('click', () => {
    state.searchQuery = '';
    state.currentLang = 'all';
    searchInput.value = '';
    langFilter.value = 'all';
    
    if (state.data[state.currentTime]) {
        const filteredData = filterData(state.data[state.currentTime]);
        renderCards(filteredData);
    }
});

// Glitch Typing Effect
function initTypingEffect() {
    const title = document.querySelector('.hero-title');
    if (!title) return;
    
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    
    const final_text = title.getAttribute('data-text');
    const chars = '!<>-_\\\\/[]{}—=+*^?#________';
    let iterations = 0;
    
    const interval = setInterval(() => {
        title.innerText = final_text.split('').map((char, index) => {
            if (index < iterations) {
                return final_text[index];
            }
            return chars[Math.floor(Math.random() * chars.length)];
        }).join('');
        
        if (iterations >= final_text.length) {
            clearInterval(interval);
        }
        
        iterations += 1 / 3;
    }, 30);
}

// Canvas Hero Animation
function initHeroCanvas() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    
    const mouse = {
        x: null,
        y: null,
        radius: 150
    };
    
    let scrollY = 0;
    
    function resize() {
        width = canvas.width = canvas.parentElement.offsetWidth;
        height = canvas.height = canvas.parentElement.offsetHeight;
        initParticles();
    }
    
    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.baseRadius = Math.random() * 1.5 + 0.5;
            this.radius = this.baseRadius;
            this.pulseTimer = Math.random() * 800;
        }
        
        update() {
            this.x += this.vx;
            this.y += this.vy;
            
            if (this.x < 0 || this.x > width) this.vx = -this.vx;
            if (this.y < 0 || this.y > height) this.vy = -this.vy;
            
            // Mouse interaction (repel)
            if (mouse.x != null && mouse.y != null) {
                // Calculate Y accounting for parallax shift
                let actualY = this.y - (scrollY * 0.2);
                let dx = mouse.x - this.x;
                let dy = mouse.y - actualY;
                let distance = Math.sqrt(dx*dx + dy*dy);
                if (distance < mouse.radius) {
                    const forceDirectionX = dx / distance;
                    const forceDirectionY = dy / distance;
                    const force = (mouse.radius - distance) / mouse.radius;
                    this.x -= forceDirectionX * force * 1.5;
                    this.y -= forceDirectionY * force * 1.5;
                }
            }
            
            // Occasional pulse effect
            this.pulseTimer--;
            if (this.pulseTimer < 0) {
                this.radius = this.baseRadius * 3;
                this.pulseTimer = Math.random() * 800 + 400;
            } else if (this.radius > this.baseRadius) {
                this.radius -= 0.05;
            }
        }
        
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y - (scrollY * 0.2), this.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(93, 253, 157, ${this.radius > this.baseRadius ? 0.8 : 0.4})`;
            ctx.fill();
        }
    }
    
    function initParticles() {
        particles = [];
        // Calculate particle count based on screen area, max 100
        const count = Math.min(Math.floor((width * height) / 12000), 100);
        for (let i = 0; i < count; i++) {
            particles.push(new Particle());
        }
    }
    
    function animate() {
        ctx.clearRect(0, 0, width, height);
        
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
            
            // Draw connections
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                
                if (distance < 120) {
                    ctx.beginPath();
                    
                    let opacity = 1 - (distance / 120);
                    opacity *= 0.15; // Base opacity for lines
                    
                    // Make lines brighter near mouse
                    if (mouse.x != null && mouse.y != null) {
                        const p1y = particles[i].y - (scrollY * 0.2);
                        const p2y = particles[j].y - (scrollY * 0.2);
                        const mdx = mouse.x - (particles[i].x + particles[j].x)/2;
                        const mdy = mouse.y - (p1y + p2y)/2;
                        const mDist = Math.sqrt(mdx*mdx + mdy*mdy);
                        if (mDist < mouse.radius) {
                            opacity += (1 - mDist/mouse.radius) * 0.4;
                        }
                    }
                    
                    ctx.strokeStyle = `rgba(93, 253, 157, ${opacity})`;
                    ctx.lineWidth = 1;
                    ctx.moveTo(particles[i].x, particles[i].y - (scrollY * 0.2));
                    ctx.lineTo(particles[j].x, particles[j].y - (scrollY * 0.2));
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animate);
    }
    
    window.addEventListener('resize', debounce(resize, 200));
    
    const hero = document.querySelector('.hero');
    if (hero) {
        let isThrottled = false;
        hero.addEventListener('mousemove', (e) => {
            if (isThrottled) return;
            isThrottled = true;
            setTimeout(() => isThrottled = false, 16); // ~60fps throttle
            
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        });
        
        hero.addEventListener('mouseleave', () => {
            mouse.x = null;
            mouse.y = null;
        });
    }
    
    window.addEventListener('scroll', () => {
        scrollY = window.scrollY;
    }, {passive: true});
    
    resize();
    animate();
}

// Init
initTypingEffect();
initHeroCanvas();
initSkeletons();
updateDashboard();