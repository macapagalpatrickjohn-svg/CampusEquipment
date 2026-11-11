package edu.campus.equipment;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(QrDownloadsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}