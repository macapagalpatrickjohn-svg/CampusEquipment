import { ToastController } from '@ionic/angular/standalone';

export async function notify(toasts: ToastController, message: string) {
  const toast = await toasts.create({ message, duration: 3400, position: 'top' });
  await toast.present();
}
