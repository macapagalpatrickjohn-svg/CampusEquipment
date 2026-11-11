package edu.campus.equipment;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.OutputStream;

@CapacitorPlugin(name = "QrDownloads")
public class QrDownloadsPlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String filename = call.getString("filename", "");
        String base64 = call.getString("base64", "");
        if (!filename.matches("EQ-[0-9A-F-]{36}\\.png") || base64.isEmpty() || base64.length() > 500000) {
            call.reject("Invalid QR image.");
            return;
        }

        ContentResolver resolver = getContext().getContentResolver();
        Uri uri = null;
        try {
            byte[] png = Base64.decode(base64, Base64.DEFAULT);
            ContentValues entry = new ContentValues();
            entry.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
            entry.put(MediaStore.MediaColumns.MIME_TYPE, "image/png");
            entry.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Campus Equipment");
            entry.put(MediaStore.MediaColumns.IS_PENDING, 1);
            uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, entry);
            if (uri == null) throw new IOException("Could not create download");
            try (OutputStream stream = resolver.openOutputStream(uri)) {
                if (stream == null) throw new IOException("Could not open download");
                stream.write(png);
            }
            // Publish only after the entire PNG has been written.
            ContentValues complete = new ContentValues();
            complete.put(MediaStore.MediaColumns.IS_PENDING, 0);
            if (resolver.update(uri, complete, null, null) != 1) throw new IOException("Could not publish download");
        } catch (Exception error) {
            if (uri != null) {
                try {
                    resolver.delete(uri, null, null);
                } catch (Exception cleanupError) {
                    error.addSuppressed(cleanupError);
                }
            }
            call.reject("Could not save the QR image.", error);
            return;
        }
        call.resolve();
    }
}