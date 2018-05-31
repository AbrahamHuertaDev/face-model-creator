import { Component, ViewChild, ElementRef } from '@angular/core';
import { NavController } from 'ionic-angular';

import * as tf from '@tensorflow/tfjs';

import { ImageClassifier } from '../../image-classifier/image-classifier';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {

  @ViewChild('video') video: ElementRef;
  videoElement: HTMLVideoElement;
  
  @ViewChild('canvas') canvas: ElementRef;
  canvasElement: HTMLCanvasElement;
  canvasContext: CanvasRenderingContext2D;
  
  @ViewChild('faceCanvas') faceCanvas: ElementRef;
  faceCanvasElement: HTMLCanvasElement;
  faceCanvasContext: CanvasRenderingContext2D;

  faceDetector = new window['FaceDetector']({ fastMode: true });
  faceDetectionInterval;
  firstFace;

  data = {};

  objectKeys = Object.keys;
  labelToAdd: string;

  constructor(
    private imageClassifier: ImageClassifier
  ) {
  }

  async ionViewDidEnter() {
    this.videoElement = this.video.nativeElement;
    this.canvasElement = this.canvas.nativeElement;

    this.faceCanvasElement = this.faceCanvas.nativeElement;
    this.faceCanvasContext = this.faceCanvasElement.getContext('2d');

    this.startWebcamAndFaceDetection();

    window.onresize = () => this.resizeCanvas();
  }

  private startWebcamAndFaceDetection() {
    navigator.getUserMedia({ video: true },
      localMediaStream => {
        this.videoElement.srcObject = localMediaStream;
        this.videoElement.onloadeddata = () => {
          this.startFaceRecognition();

          this.resizeCanvas();
        }
      },
      err => console.log('The following error occurred when trying to use getUserMedia: ' + err)
    );
  }

  private resizeCanvas() {
    this.canvasElement.width = this.videoElement.videoWidth;
    this.canvasElement.height = this.videoElement.videoHeight;
    this.canvasElement.style.width = this.videoElement.clientWidth + 'px';
    this.canvasElement.style.height = this.videoElement.clientHeight + 'px';
    this.canvasContext = this.canvasElement.getContext('2d');
  }

  private startFaceRecognition() {
    this.faceDetectionInterval = setInterval(async () => {
      if (this.imageClassifier.isTraining) {
        this.clearCanvas();
        return;
      }

      const faces = await this.detectFaces();
      this.firstFace = faces[0];

      this.clearCanvas();
      faces.forEach(async face => {
        const { width, height, x, y } = face.boundingBox;
        this.faceCanvasContext.drawImage(this.videoElement, x, y, width, height, 0, 0, this.faceCanvasElement.width, this.faceCanvasElement.height);
        const imageData = this.faceCanvasContext.getImageData(0, 0, this.faceCanvasElement.width, this.faceCanvasElement.height);

        this.drawFaceRectangle(face, await this.imageClassifier.predict(imageData));
      });
    }, 100);
  }

  private async detectFaces() {
    const faces = await this.faceDetector.detect(this.video.nativeElement);
    return faces;
  }

  private clearCanvas() {
    this.canvasContext.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
  }

  private drawFaceRectangle(face, label) {
    const { width, height, x, y } = face.boundingBox;

    this.canvasContext.strokeStyle = '#00FF00';
    this.canvasContext.fillStyle = '#00FF00';
    this.canvasContext.font = "14px Arial";

    this.canvasContext.lineWidth = 2;
    this.canvasContext.strokeRect(x, y, width, height);

    this.canvasContext.fillText(label, x + 5, y - 10);
  }

  onAddLabel(label) {
    if (!label || this.data[label]) {
      return;
    }
    
    this.data[label] = [];
    this.labelToAdd = '';
  }

  onAddPicture(label) {
    if (!this.firstFace) {
      return;
    }
    
    const { width, height, x, y } = this.firstFace.boundingBox;
    this.faceCanvasContext.drawImage(this.videoElement, x, y, width, height, 0, 0, this.faceCanvasElement.width, this.faceCanvasElement.height);

    const imageData = this.faceCanvasContext.getImageData(0, 0, this.faceCanvasElement.width, this.faceCanvasElement.height);
    this.data[label].push(imageData);
  }

  onTrainModel() {
    this.imageClassifier.trainModel(this.data);
  }

  async onExportModel() {
    await this.imageClassifier.headModel.save('downloads://model');

    var exportableData = this.getExportableData();
    this.downloadExportableData(exportableData);
  }

  private downloadExportableData(exportableData) {
    var a = document.createElement("a");
    var file = new Blob([JSON.stringify(exportableData)], { type: 'text/json' });
    a.href = URL.createObjectURL(file);
    a.download = 'model-data.json';
    a.click();
  }

  private getExportableData() {
    var exportableData = {};
    Object.keys(this.data).forEach(k => {
      exportableData[k] = this.data[k].map(img => Array.from(img.data));
    });
    return exportableData;
  }

  async onImportModel() {
    const jsonUpload: HTMLInputElement = <HTMLInputElement>document.getElementById('json-upload');
    const weightsUpload: HTMLInputElement = <HTMLInputElement>document.getElementById('weights-upload');
    const dataUpload: HTMLInputElement = <HTMLInputElement>document.getElementById('data-upload');

    this.data = await this.readJSONFile(dataUpload.files[0]);
    this.imageClassifier.labels = Object.keys(this.data);
    this.imageClassifier.headModel = await tf.loadModel(tf.io.browserFiles([jsonUpload.files[0], weightsUpload.files[0]]));
  }
  
  private readJSONFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (fileEvent) => {
        const contents = fileEvent.target.result;
        resolve(this.JSONToData(contents));
      };
      reader.readAsText(file);
    });
  }

  private JSONToData(contents: any) {
    const toJSON = JSON.parse(contents);
    Object.keys(toJSON).forEach(k => {
      toJSON[k] = toJSON[k].map(img => new ImageData(Uint8ClampedArray.from(img), 224, 224));
    });
    return toJSON;
  }
}
