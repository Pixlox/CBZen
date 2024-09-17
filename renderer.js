const { ipcRenderer } = require('electron');
const fs = require('fs');

const openFileBtn = document.getElementById('open-file-btn');
const recentFilesList = document.getElementById('recent-files');
const imageContainer = document.getElementById('image-container');
const sidebar = document.getElementById('sidebar');
const divider = document.getElementById('divider');
const loadingText = document.createElement('div');
loadingText.id = 'loading-text';
document.body.appendChild(loadingText);

// Create bottom bar
const bottomBar = document.createElement('div');
bottomBar.id = 'bottom-bar';
document.body.appendChild(bottomBar);

let recentFiles = JSON.parse(localStorage.getItem('recentFiles')) || [];
let currentFileName = '';
let currentImageIndex = 0;
let totalImages = 0;

function populateRecentFiles() {
  recentFilesList.innerHTML = '';
  recentFiles.forEach((filePath, index) => {
    const li = document.createElement('li');
    const fileName = filePath.split('/').pop().replace('.cbz', '');
    li.innerHTML = `
      <span class="file-name">${fileName}</span>
      <span class="remove-file">×</span>
    `;
    
    if (!fs.existsSync(filePath)) {
      li.classList.add('missing-file');
    }
    
    li.addEventListener('click', (e) => {
      if (!e.target.classList.contains('remove-file')) {
        openCbz(filePath, li);
      }
    });
    li.querySelector('.remove-file').addEventListener('click', (e) => {
      e.stopPropagation();
      removeRecentFile(index);
    });
    
    recentFilesList.appendChild(li);
  });
}

function removeRecentFile(index) {
  recentFiles.splice(index, 1);
  localStorage.setItem('recentFiles', JSON.stringify(recentFiles));
  populateRecentFiles();
}

openFileBtn.addEventListener('click', async () => {
  const result = await ipcRenderer.invoke('open-file-dialog');

  if (result && result.images && result.images.length > 0) {
    await openCbz(result.filePath);
    
    if (!recentFiles.includes(result.filePath)) {
      recentFiles.push(result.filePath);
      localStorage.setItem('recentFiles', JSON.stringify(recentFiles));
      populateRecentFiles();
    }
  }
});

function displayImages(images) {
  imageContainer.innerHTML = '';
  totalImages = images.length;
  currentImageIndex = 0;
  images.forEach((imagePath, index) => {
    const img = document.createElement('img');
    img.src = `file://${imagePath}`;
    img.addEventListener('load', () => {
      if (index === 0) {
        updateBottomBar();
      }
    });
    imageContainer.appendChild(img);
  });

  // Add scroll event listener to update progress
  imageContainer.addEventListener('scroll', updateProgress);
}

function updateProgress() {
  const images = imageContainer.querySelectorAll('img');
  const containerRect = imageContainer.getBoundingClientRect();
  let visibleIndex = 0;

  for (let i = 0; i < images.length; i++) {
    const imgRect = images[i].getBoundingClientRect();
    if (imgRect.top <= containerRect.top && imgRect.bottom >= containerRect.top) {
      visibleIndex = i;
      break;
    }
  }

  currentImageIndex = visibleIndex;
  updateBottomBar();
}

function updateBottomBar() {
    const progress = ((currentImageIndex + 1) / totalImages * 100).toFixed(0);
  
    // Create or update the bottom bar elements
    let fileNameElem = document.getElementById('file-name');
    let progressElem = document.getElementById('progress');
  
    if (!fileNameElem) {
      fileNameElem = document.createElement('span');
      fileNameElem.id = 'file-name';
      bottomBar.appendChild(fileNameElem);
    }
  
    if (!progressElem) {
      progressElem = document.createElement('span');
      progressElem.id = 'progress';
      bottomBar.appendChild(progressElem);
    }
  
    // Update text content
    fileNameElem.textContent = `Currently reading: ${currentFileName}`;
    progressElem.textContent = `Progress: ${progress}%`;
  }
  

async function openCbz(filePath, listItem) {
  try {
    currentFileName = filePath.split('/').pop().replace('.cbz', '');
    loadingText.textContent = `Loading ${currentFileName}...`;
    loadingText.style.display = 'block';

    const images = await ipcRenderer.invoke('open-file-from-path', filePath);
    
    if (images && images.length > 0) {
      displayImages(images);
      if (listItem && listItem.classList.contains('missing-file')) {
        listItem.classList.remove('missing-file');
      }
    }
  } catch (error) {
    console.error('Error opening file:', error);
    if (listItem && listItem.classList.contains('missing-file')) {
      removeRecentFile(recentFiles.indexOf(filePath));
    }
  } finally {
    loadingText.style.display = 'none';
  }
}

let isResizing = false;
let startX, startWidth;

divider.addEventListener('mousedown', (e) => {
  isResizing = true;
  startX = e.clientX;
  startWidth = parseInt(getComputedStyle(sidebar).width, 10);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', stopResize);
});

function handleMouseMove(e) {
  if (!isResizing) return;
  const newWidth = startWidth + (e.clientX - startX);
  sidebar.style.width = `${newWidth}px`;
}

function stopResize() {
  isResizing = false;
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', stopResize);
}

populateRecentFiles();
