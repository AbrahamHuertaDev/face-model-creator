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
  trackerTask;
  isTracking;
  faces = [];

  public async init() {
    this.tracker = new tracking.ObjectTracker(['face']);
    this.tracker.setInitialScale(2);
    this.tracker.setStepSize(2);
    this.tracker.setEdgesDensity(0.1);
  }

  public stop() {
    this.trackerTask.stop();
    this.isTracking = false;
  }
  
  public async detect(drawable) : Promise<Face[]> {
    if(!this.isTracking) {
      this.startTracking(drawable);
    }

    return this.faces;
  }

  private startTracking(drawable) {
    if(!this.trackerTask){
      this.trackerTask = tracking.track('#' + drawable.id, this.tracker, { camera: false });
    }
    
    this.isTracking = true;
    
    this.trackerTask.run();
    this.tracker.on('track', event => {
      this.faces = event.data;
    });
  }
}