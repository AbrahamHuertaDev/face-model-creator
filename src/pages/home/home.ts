import { Component, ViewChild, ElementRef } from '@angular/core';
import { NavController } from 'ionic-angular';

import * as tf from '@tensorflow/tfjs';

import { ImageClassifier } from '../../systems/image-classifier';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {

  @ViewChild('video') video: ElementRef;
  @ViewChild('canvas') canvas: ElementRef;
  @ViewChild('faceCanvas') faceCanvas: ElementRef;

  videoElement: HTMLVideoElement;
  canvasElement: HTMLCanvasElement;
  canvasContext: CanvasRenderingContext2D;
  faceCanvasElement: HTMLCanvasElement;
  faceCanvasContext: CanvasRenderingContext2D;

  faceDetector = new window['FaceDetector']({ fastMode: true });
  faceDetectionInterval;
  firstFace;

  model;
  data = {};

  objectKeys = Object.keys;
  label: string;
  training: boolean;
  loss: number;

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
  }

  private startWebcamAndFaceDetection() {
    navigator.getUserMedia({ video: true },
      localMediaStream => {
        this.videoElement.srcObject = localMediaStream;
        this.videoElement.onloadeddata = () => {
          this.startFaceDetection();

          this.canvasElement.width = this.videoElement.videoWidth;
          this.canvasElement.height = this.videoElement.videoHeight;

          this.canvasElement.style.width = this.videoElement.clientWidth + 'px';
          this.canvasElement.style.height = this.videoElement.clientHeight + 'px';

          this.canvasContext = this.canvasElement.getContext('2d');
        }
      },
      err => console.log('The following error occurred when trying to use getUserMedia: ' + err)
    );
  }

  private startFaceDetection() {
    this.faceDetectionInterval = setInterval(async () => {
      if (this.training) {
        this.clearCanvas();
        return;
      }

      const faces = await this.detectFaces();
      this.firstFace = faces[0];

      this.clearCanvas();
      faces.forEach(async face => {
        this.drawFaceRectangle(face, await this.predict(face));
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

  

  addLabel(label) {
    if (label && !this.data[label]) {
      this.data[label] = [];
    }

    this.label = '';
  }

  addPicture(label) {
    if (this.firstFace) {
      const { width, height, x, y } = this.firstFace.boundingBox;
      this.faceCanvasContext.drawImage(this.videoElement, x, y, width, height, 0, 0, this.faceCanvasElement.width, this.faceCanvasElement.height);

      this.data[label].push(this.faceCanvasContext.getImageData(0, 0, this.faceCanvasElement.width, this.faceCanvasElement.height));
    }
  }

  trainModel() {
    this.training = true;
    const controllerDataset = this.dataToDataset();

    let model = tf.sequential({
      layers: [
        tf.layers.flatten({ inputShape: [7, 7, 256] }),
        tf.layers.dense({
          units: 100,
          activation: 'relu',
          kernelInitializer: 'varianceScaling',
          useBias: true
        }),

        tf.layers.dense({
          units: Object.keys(this.data).length,
          kernelInitializer: 'varianceScaling',
          useBias: false,
          activation: 'softmax'
        })
      ]
    });

    const optimizer = tf.train.adam(0.00001);
    model.compile({ optimizer: optimizer, loss: 'categoricalCrossentropy' });

    let callbacks: any = {
      batchSize: 10,
      epochs: 20,
      callbacks: {
        onBatchEnd: async (batch, logs) => {
          this.loss = logs.loss;
          await tf.nextFrame();
        },
        onTrainEnd: () => {
          this.model = model;
          this.training = false;
        }
      }
    }

    model.fit(controllerDataset.xs, controllerDataset.ys, callbacks);
  }

  dataToDataset() {
    const labels = Object.keys(this.data);

    let ys;
    let xs;

    labels.forEach((label, index) => {
      this.data[label].forEach(image => {
        const y = tf.tidy(() => tf.oneHot(tf.tensor1d([index]).toInt(), labels.length));
        const x = this.imageClassifier.predictMobilenet(image);

        if (!ys) {
          ys = tf.keep(y);
          xs = tf.keep(x);
        } else {
          const oldY = ys;
          ys = tf.keep(oldY.concat(y, 0));

          const oldX = xs;
          xs = tf.keep(oldX.concat(x, 0));

          oldY.dispose();
          oldX.dispose();
        }
      });
    });

    return { xs, ys }
  }

  async exportModel() {
    await this.model.save('downloads://model');

    var exp = {}
    Object.keys(this.data).forEach(k => {
      exp[k] = this.data[k].map(img => Array.from(img.data));
    })

    var a = document.createElement("a");
    var file = new Blob([JSON.stringify(exp)], { type: 'text/json' });
    a.href = URL.createObjectURL(file);
    a.download = 'model-data.json';
    a.click();
  }

  async importModel() {
    const jsonUpload: HTMLInputElement = <HTMLInputElement>document.getElementById('json-upload');
    const weightsUpload: HTMLInputElement = <HTMLInputElement>document.getElementById('weights-upload');
    const dataUpload: HTMLInputElement = <HTMLInputElement>document.getElementById('data-upload');

    this.model = await tf.loadModel(tf.io.browserFiles([jsonUpload.files[0], weightsUpload.files[0]]));

    const reader = new FileReader();
    reader.onload = (e) => {
      const contents = e.target.result;
      const toJSON = JSON.parse(contents);

      Object.keys(toJSON).forEach(k => {
        toJSON[k] = toJSON[k].map(img => new ImageData(Uint8ClampedArray.from(img), 224, 224));
      });

      this.data = toJSON;
    };
    reader.readAsText(dataUpload.files[0]);
  }

  

  async predict(face) {
    if (!this.model) {
      return '????';
    }

    const { width, height, x, y } = face.boundingBox;
    this.faceCanvasContext.drawImage(this.videoElement, x, y, width, height, 0, 0, this.faceCanvasElement.width, this.faceCanvasElement.height);

    const image = tf.tidy(() => {
      const faceImage = tf.fromPixels(this.faceCanvasContext.getImageData(0, 0, this.faceCanvasElement.width, this.faceCanvasElement.height));
      const batchedImage = faceImage.expandDims(0);

      return batchedImage.toFloat().div(tf.scalar(127)).sub(tf.scalar(1));
    });

    const activations = this.imageClassifier.mobilenet.predict(image);
    const predictions = this.model.predict(activations);
    const pred = await predictions.as1D().argMax().data();
    return Object.keys(this.data)[pred[0]];
  }
}
