import { Injectable } from '@angular/core';

import { FaceDetector, Face } from "../face-recognizer.interfaces";

import 'tracking';
import 'tracking/build/data/face';

declare var tracking: any;

@Injectable({
  providedIn: 'root' 
})
export class TrackingJSFaceDetector implements FaceDetector {

  tracker;
  isTracking;
  faces = [];

  public async init() {
    this.tracker = new tracking.ObjectTracker(['face']);
    this.tracker.setInitialScale(4);
    this.tracker.setStepSize(2);
    this.tracker.setEdgesDensity(0.1);
  }
  
  public async detect(drawable) : Promise<Face[]> {
    if(!this.isTracking) {
      this.startTracking(drawable);
    }

    return this.faces;
  }

  private startTracking(drawable) {
    this.isTracking = true;
    
    tracking.track(drawable, this.tracker, { camera: true });
    this.tracker.on('track', event => {
      this.faces = event.data;
    });
  }
}