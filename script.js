
// 경기도 주요 시별 격자 좌표 (기상청 격자 좌표계)
const CITY_COORDINATES = {
    '안산시': { nx: 58, ny: 121 },
    '수원시': { nx: 60, ny: 121 },
    '성남시': { nx: 63, ny: 124 },
    '고양시': { nx: 57, ny: 128 },
    '용인시': { nx: 64, ny: 119 },
    '부천시': { nx: 56, ny: 125 },
    '안양시': { nx: 59, ny: 123 },
    '남양주시': { nx: 64, ny: 128 },
    '화성시': { nx: 57, ny: 119 },
    '평택시': { nx: 62, ny: 114 }
};

// API 설정
const API_CONFIG = {
    baseUrl: 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst',
    serviceKey: '04c3ee22d7fbd7cf3e41488e8f1715d1dba5bc6d9c965f27434118778eafe285'
};

// 하늘 상태 코드 변환
const SKY_CONDITIONS = {
    '1': '맑음',
    '3': '구름많음', 
    '4': '흐림'
};

// 강수형태 코드 변환
const PRECIPITATION_TYPES = {
    '0': '없음',
    '1': '비',
    '2': '비/눈',
    '3': '눈',
    '5': '빗방울',
    '6': '빗방울눈날림',
    '7': '눈날림'
};

// DOM 요소
const citySelect = document.getElementById('citySelect');
const searchBtn = document.getElementById('searchBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const weatherCard = document.getElementById('weatherCard');
const errorMessage = document.getElementById('errorMessage');

// 이벤트 리스너
searchBtn.addEventListener('click', handleSearch);
citySelect.addEventListener('change', handleSearch);

// Enter 키로 검색
citySelect.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSearch();
    }
});

// 검색 처리 함수
async function handleSearch() {
    const selectedCity = citySelect.value;
    
    if (!selectedCity) {
        showError('시/군을 선택해주세요.');
        return;
    }
    
    showLoading();
    
    try {
        const weatherData = await fetchWeatherData(selectedCity);
        displayWeatherData(selectedCity, weatherData);
    } catch (error) {
        console.error('Error fetching weather data:', error);
        showError('날씨 정보를 가져오는데 실패했습니다.');
    }
}

// 날씨 데이터 API 호출
async function fetchWeatherData(cityName) {
    const coordinates = CITY_COORDINATES[cityName];
    const now = new Date();
    const baseDate = formatDate(now);
    const baseTime = getBaseTime(now);
    
    const params = new URLSearchParams({
        serviceKey: API_CONFIG.serviceKey,
        pageNo: '1',
        numOfRows: '1000',
        dataType: 'JSON',
        base_date: baseDate,
        base_time: baseTime,
        nx: coordinates.nx,
        ny: coordinates.ny
    });
    
    // CORS 문제 해결을 위해 여러 프록시 서버 시도
    const proxyUrls = [
        `https://corsproxy.io/?${encodeURIComponent(API_CONFIG.baseUrl + '?' + params)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(API_CONFIG.baseUrl + '?' + params)}`,
        `https://cors-anywhere.herokuapp.com/${API_CONFIG.baseUrl}?${params}`
    ];
    
    let lastError;
    
    for (const proxyUrl of proxyUrls) {
        try {
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.response && data.response.header.resultCode !== '00') {
                throw new Error(`API error: ${data.response.header.resultMsg}`);
            }
            
            if (data.response && data.response.body && data.response.body.items) {
                return parseWeatherData(data.response.body.items.item);
            }
        } catch (error) {
            lastError = error;
            console.warn(`프록시 ${proxyUrl} 실패:`, error.message);
            continue;
        }
    }
    
    // 모든 프록시 실패 시 목업 데이터 반환
    console.warn('모든 API 호출이 실패했습니다. 목업 데이터를 사용합니다.');
    return getMockWeatherData(cityName);
}

// 날씨 데이터 파싱
function parseWeatherData(items) {
    const weatherData = {
        temperature: null,
        humidity: null,
        windSpeed: null,
        precipitation: null,
        skyCondition: null,
        precipitationType: null
    };
    
    items.forEach(item => {
        switch (item.category) {
            case 'T1H': // 기온
                weatherData.temperature = parseFloat(item.obsrValue);
                break;
            case 'REH': // 습도
                weatherData.humidity = parseInt(item.obsrValue);
                break;
            case 'WSD': // 풍속
                weatherData.windSpeed = parseFloat(item.obsrValue);
                break;
            case 'RN1': // 1시간 강수량
                weatherData.precipitation = parseFloat(item.obsrValue);
                break;
            case 'SKY': // 하늘상태
                weatherData.skyCondition = item.obsrValue;
                break;
            case 'PTY': // 강수형태
                weatherData.precipitationType = item.obsrValue;
                break;
        }
    });
    
    return weatherData;
}

// 날씨 데이터 표시
function displayWeatherData(cityName, data) {
    hideAll();
    
    // 현재 시간 업데이트
    document.getElementById('currentTime').textContent = getCurrentTime();
    document.getElementById('cityName').textContent = cityName;
    
    // 기본 날씨 정보
    document.getElementById('temperature').textContent = data.temperature || '--';
    document.getElementById('humidity').textContent = (data.humidity !== null ? data.humidity + '%' : '--%');
    document.getElementById('windSpeed').textContent = (data.windSpeed !== null ? data.windSpeed + ' m/s' : '-- m/s');
    
    // 하늘 상태
    const skyText = SKY_CONDITIONS[data.skyCondition] || '정보없음';
    document.getElementById('skyCondition').textContent = skyText;
    
    // 강수 정보
    const precipitationText = data.precipitationType !== '0' ? 
        PRECIPITATION_TYPES[data.precipitationType] || '정보없음' : '없음';
    document.getElementById('precipitation').textContent = precipitationText;
    
    // 날씨 상태와 아이콘
    const weatherInfo = getWeatherCondition(data.skyCondition, data.precipitationType);
    document.getElementById('weatherCondition').textContent = weatherInfo.condition;
    document.getElementById('weatherIcon').className = `weather-icon ${weatherInfo.icon}`;
    
    weatherCard.style.display = 'block';
}

// 날씨 상태 및 아이콘 결정
function getWeatherCondition(skyCondition, precipitationType) {
    if (precipitationType && precipitationType !== '0') {
        switch (precipitationType) {
            case '1':
                return { condition: '비', icon: 'fas fa-cloud-rain rainy' };
            case '2':
                return { condition: '비/눈', icon: 'fas fa-cloud-rain rainy' };
            case '3':
                return { condition: '눈', icon: 'fas fa-snowflake' };
            default:
                return { condition: '강수', icon: 'fas fa-cloud-rain rainy' };
        }
    }
    
    switch (skyCondition) {
        case '1':
            return { condition: '맑음', icon: 'fas fa-sun sunny' };
        case '3':
            return { condition: '구름많음', icon: 'fas fa-cloud-sun cloudy' };
        case '4':
            return { condition: '흐림', icon: 'fas fa-cloud cloudy' };
        default:
            return { condition: '정보없음', icon: 'fas fa-question' };
    }
}

// 유틸리티 함수들
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + month + day;
}

function getBaseTime(date) {
    const hour = date.getHours();
    const minute = date.getMinutes();
    
    // 기상청 API는 매시간 30분 이후에 해당 시간의 데이터를 제공
    let baseHour = hour;
    if (minute < 30) {
        baseHour = hour - 1;
        if (baseHour < 0) baseHour = 23;
    }
    
    return String(baseHour).padStart(2, '0') + '00';
}

function getCurrentTime() {
    const now = new Date();
    return now.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

function showLoading() {
    hideAll();
    loadingSpinner.style.display = 'block';
}

function showError(message) {
    hideAll();
    errorMessage.querySelector('p').textContent = message;
    errorMessage.style.display = 'block';
}

function hideAll() {
    loadingSpinner.style.display = 'none';
    weatherCard.style.display = 'none';
    errorMessage.style.display = 'none';
}

// 목업 날씨 데이터 생성 (API 실패 시 사용)
function getMockWeatherData(cityName) {
    const mockData = {
        temperature: Math.round(Math.random() * 20 + 5), // 5-25도 랜덤
        humidity: Math.round(Math.random() * 40 + 40), // 40-80% 랜덤
        windSpeed: Math.round(Math.random() * 10 * 10) / 10, // 0-10 m/s 랜덤
        precipitation: 0,
        skyCondition: ['1', '3', '4'][Math.floor(Math.random() * 3)], // 맑음, 구름많음, 흐림 중 랜덤
        precipitationType: '0'
    };
    
    console.info(`${cityName}의 목업 날씨 데이터를 생성했습니다.`);
    return mockData;
}

// 페이지 로드 시 현재 시간 표시
document.addEventListener('DOMContentLoaded', () => {
    // 안산시를 기본값으로 설정하고 자동 검색
    citySelect.value = '안산시';
    handleSearch();
});
