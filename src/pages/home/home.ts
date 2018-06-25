import { Component, ViewChild, ElementRef } from '@angular/core';
import { LoadingController, AlertController } from 'ionic-angular';

import { FaceRecognizerInteractor } from '../../face-recognizer/face-recognizer.interactor';
import { Observable } from 'rxjs';

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

  faceDetectionInterval;
  isFaceDetectionCrashed = false;
  firstFace;

  objectKeys = Object.keys;
  labelToAdd: string;

  trainingObservable: Observable<any>;

  constructor(
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private faceRecognizer: FaceRecognizerInteractor
  ) {
  }

  public async ionViewDidEnter() {
    this.videoElement = this.video.nativeElement;
    this.canvasElement = this.canvas.nativeElement;

    this.faceCanvasElement = this.faceCanvas.nativeElement;
    this.faceCanvasContext = this.faceCanvasElement.getContext('2d');

    await this.startWebcam();
    await this.startFaceDetection();

    this.trainingObservable = this.faceRecognizer.getTrainingObservable();

    window.onresize = () => this.resizeCanvas();

    if(!this.isWebGLAvailable()) {
      this.presentWebGLUnavailable();
    }
  }

  private isWebGLAvailable() {
    var canvas = document.createElement('canvas');
    return !!(window['WebGLRenderingContext'] && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  }

  private presentWebGLUnavailable() {
    let alert = this.alertCtrl.create({
      title: 'WebGL is not available!',
      message: 'Check browser support. If it was an error open the app in a new tab.',
      buttons: ['Dismiss']
    });
    alert.present();
  }

  private startWebcam() {
    const getUserMedia = (resolve, reject) => {
      navigator.getUserMedia({ video: true },
        localMediaStream => {
          this.videoElement.srcObject = localMediaStream;
          this.videoElement.onloadeddata = () => {
            this.resizeCanvas();
            resolve()
          }
        },
        err => reject(err)
      );
    };

    return new Promise((resolve, reject) => getUserMedia(resolve, reject));
  }

  private startFaceDetection() {
    this.faceDetectionInterval = setInterval(async () => {
      const faces = await this.faceRecognizer.detectFaces(this.videoElement).catch(() => null);
      if(!faces) {
        if(this.isFaceDetectionCrashed) {
          this.stopFaceDetection();
          this.presentFaceCrashAlert();
        }

        this.isFaceDetectionCrashed = true;
        return
      }

      this.firstFace = faces[0];
      this.clearCanvas();
      faces.forEach(async (face, index) => await this.drawFace(face, index));
    }, 100);
  }

  private presentFaceCrashAlert() {
    let alert = this.alertCtrl.create({
      title: 'Face detection crash!',
      message: 'Please reload.',
      buttons: ['Dismiss']
    });
    alert.present();
  }

  private stopFaceDetection() {
    clearInterval(this.faceDetectionInterval);
  }

  private clearCanvas() {
    this.canvasContext.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
  }

  private async drawFace(face, index) {
    this.drawInFaceCanvas(face);
    const imageData = this.getFaceCanvasImageData();

    const color = index === 0 ? '#0000FF' : '#00FF00';
    const prediction = await this.faceRecognizer.predict(imageData);
    this.drawFaceRectangle(face, prediction, color);
  }

  private drawFaceRectangle(face, label, color) {
    const { width, height, x, y } = face;

    this.canvasContext.strokeStyle = color;
    this.canvasContext.fillStyle = color;
    this.canvasContext.font = "14px Arial";

    this.canvasContext.lineWidth = 2;
    this.canvasContext.strokeRect(x, y, width, height);

    this.canvasContext.fillText(label, x + 5, y - 10);
  }

  private resizeCanvas() {
    this.canvasElement.width = this.videoElement.videoWidth;
    this.canvasElement.height = this.videoElement.videoHeight;
    this.canvasElement.style.width = this.videoElement.clientWidth + 'px';
    this.canvasElement.style.height = this.videoElement.clientHeight + 'px';
    this.canvasContext = this.canvasElement.getContext('2d');
  }

  public onAddLabel(label) {
    this.faceRecognizer.addLabel(label);
    this.labelToAdd = '';
  }

  public onAddPicture(label) {
    if (!this.firstFace) {
      return;
    }

    this.drawInFaceCanvas(this.firstFace);
    const imageData = this.getFaceCanvasImageData();
    const dataURL = this.getFaceCanvasDataURL();
    this.faceRecognizer.storeImage(label, imageData, dataURL);
  }

  private drawInFaceCanvas(face: any) {
    const { width, height, x, y } = face;
    this.faceCanvasContext.drawImage(this.videoElement, x, y, width, height, 0, 0, this.faceCanvasElement.width, this.faceCanvasElement.height);
  }

  private getFaceCanvasImageData() {
    const imageData = this.faceCanvasContext.getImageData(0, 0, this.faceCanvasElement.width, this.faceCanvasElement.height);
    return imageData;
  }

  private getFaceCanvasDataURL() {
    const dataURL = this.faceCanvasElement.toDataURL('image/jpeg');
    return dataURL;
  }

  public async onExportData() {
    await this.faceRecognizer.exportData();
  }

  public async onImportData() {
    const dataUpload: HTMLInputElement = <HTMLInputElement>document.getElementById('data-import');
    if (!dataUpload.files[0]) {
      return;
    }

    let loading = this.loadingCtrl.create({ content: 'Importing Data...' });
    await loading.present();

    await this.faceRecognizer.loadData(dataUpload.files[0]);

    loading.dismiss();
  }

  public async onTrainModel() {
    if(!this.isWebGLAvailable()) {
      this.presentCantTrainAlert();
      return;
    }

    this.stopFaceDetection();
    await this.faceRecognizer.trainModel();
    this.startFaceDetection();
  }

  private presentCantTrainAlert() {
    let alert = this.alertCtrl.create({
      title: 'WebGL is not available',
      subTitle: 'Export your data and try again reloading the page',
      buttons: ['Dismiss']
    });
    alert.present();
  }

  public async onExportModel() {
    await this.faceRecognizer.exportModel();
  }

  public async onImportModel() {
    const jsonUpload: HTMLInputElement = <HTMLInputElement>document.getElementById('json-upload');
    const weightsUpload: HTMLInputElement = <HTMLInputElement>document.getElementById('weights-upload');
    const labelsUpload: HTMLInputElement = <HTMLInputElement>document.getElementById('labels-upload');

    await this.faceRecognizer.importModel(jsonUpload.files[0], weightsUpload.files[0], labelsUpload.files[0]);
  }
}