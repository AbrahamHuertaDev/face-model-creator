import { Injectable } from '@angular/core';
import * as JSZip from 'jszip';
import { saveAs } from 'file-saver';

@Injectable({
  providedIn: 'root'
})
export class ZipImageLoader {

  async downloadDataAsZIP(data) {
    const zip = new JSZip();
    Object.keys(data).forEach(label => {
      const folder = zip.folder(label);
      data[label].forEach((image, index) => {
        folder.file(`${label}-${index}.jpeg`, image.base64, { base64: true });
      });
    });

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "model-data.zip");
  }

  async loadDataFromZIP(file) {
    const content = await JSZip.loadAsync(file);
    const data = {};
    let currentLabel;

    for(let filePath of Object.keys(content.files)) {
      console.log(filePath);
      if (filePath.split('.').pop() !== 'jpeg') {
        currentLabel = filePath.replace('/', '');
        data[currentLabel] = [];
        continue;
      }

      const file = content.files[filePath];

      const base64 = await file.async('base64').catch(console.log);
      const imageData = await this.base64ToImageData(base64).catch(console.log);
      data[currentLabel].push({imageData, base64});
    }

    return data;
  }

  private base64ToImageData(base64) {
    return new Promise((resolve) => {
      var image = new Image();
      image.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
  
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
  
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        resolve(imageData);
      }
      image.src = 'data:image/jpeg;base64,' + base64;
    })
  }
}