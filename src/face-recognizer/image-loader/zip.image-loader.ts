import { Injectable } from '@angular/core';
import * as JSZip from 'jszip';
import { saveAs } from 'file-saver';

@Injectable({
  providedIn: 'root'
})
export class ZipImageLoader {

  public async exportLabels(data) {
    const zip = new JSZip();
    Object.keys(data).forEach(label => zip.folder(label));

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "model-labels.zip");
  }

  public async exportData(data) {
    const zip = new JSZip();
    this.setZIPData(data, zip);

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "model-data.zip");
  }

  private setZIPData(data, zip) {
    Object.keys(data).forEach(label => {
      const folder = zip.folder(label);
      data[label].forEach((image, index) => {
        folder.file(`${label}-${index}.jpeg`, image.base64, { base64: true });
      });
    });
  }

  public async loadData(file) {
    const content = await JSZip.loadAsync(file);
    const data = {};
    let currentLabel;

    for(let filePath of Object.keys(content.files)) {
      if (filePath.split('.').pop() !== 'jpeg') {
        currentLabel = filePath.replace('/', '');
        data[currentLabel] = [];
        continue;
      }

      const { imageData, base64 } = await this.convertFileToData(content.files[filePath]);
      data[currentLabel].push({imageData, base64});
    }

    return data;
  }

  private async convertFileToData(file) {
    const base64 = await file.async('base64').catch(console.log);
    const imageData = await this.base64ToImageData(base64).catch(console.log);
    return { imageData, base64 };
  }

  private base64ToImageData(base64) {
    return new Promise((resolve) => {
      var image = new Image();
      image.onload = () => {
        const imageData = this.getImageData(image);
        resolve(imageData);
      }
      image.src = 'data:image/jpeg;base64,' + base64;
    })
  }

  private getImageData(image: HTMLImageElement) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    return imageData;
  }
}