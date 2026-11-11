import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, arrowDownOutline, arrowForwardOutline, createOutline, cameraOutline, checkmarkCircleOutline, cubeOutline, gridOutline, imageOutline, layersOutline, lockClosedOutline, qrCodeOutline, readerOutline, returnDownBackOutline, searchOutline, shieldCheckmarkOutline, timeOutline, trashOutline } from 'ionicons/icons';
import { CampusApp } from './app/app.component';
import { routes } from './app/app.routes';

addIcons({ addOutline, arrowDownOutline, arrowForwardOutline, createOutline, cameraOutline, checkmarkCircleOutline, cubeOutline, gridOutline, imageOutline, layersOutline, lockClosedOutline, qrCodeOutline, readerOutline, returnDownBackOutline, searchOutline, shieldCheckmarkOutline, timeOutline, trashOutline });

bootstrapApplication(CampusApp, {
  providers: [
    provideIonicAngular({ mode: 'md', animated: false }),
    provideRouter(routes),
  ],
}).catch(console.error);
