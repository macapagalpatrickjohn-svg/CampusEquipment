# Campus Equipment Inventory and Borrowing Tracker

A single-device Ionic and Angular app for an equipment desk. Group identical equipment under one name and photo, then label and lend each physical unit separately.

## Run it

Use Node.js 22.12 or later in the Node 22 series. Open Command Prompt or PowerShell in the extracted `campus-equipment` directory.

```cmd
npm ci --include=dev
npm start
```

Open http://localhost:4200. If the Ionic CLI is installed, `ionic serve` also works on http://localhost:8100 after `npm ci`. The browser preview uses file upload, manual Unit ID lookup, and the browser download folder.

If a Windows install stops with `esbuild.exe EBUSY` or `EPERM` cleanup warnings, stop the install and extract the ZIP into a fresh folder. Retry `npm ci --include=dev` there. Restart Windows before retrying if the lock persists.

## Open or build in Android Studio

Install Android Studio, Android SDK Platform 35, Android SDK Build-Tools 35.0.0, and Platform-Tools. Use JDK 21 for Gradle.

```cmd
npm ci --include=dev
npm run android:sync
npm run android:open
```

You can also open the extracted project's `android` directory manually. Select an Android 10 or newer device and click **Run**. For an installable debug APK, use Android Studio's **Generate APKs** action or run `gradlew.bat assembleDebug` from `android`. On macOS or Linux, use `./gradlew assembleDebug`. The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. Run `npm run android:sync` again after changing the web source.

## Use the equipment desk

1. **Admin** · Enter **2026** to add, edit, or delete equipment. Tap **Lock admin** to sign out. The local session also resets when the app restarts. The fixed PIN is a classroom access gate and is visible in the source. Inventory viewing and loan operations are accessible without entering the PIN.
2. **Add** · Enter a name, photo, and quantity. Each unit receives its own ID. Preview and download the QR PNG for each unit. Android saves the file under **Downloads → Campus Equipment**. Print and attach one label per unit.
3. **Inventory** · Search by name or Unit ID. Open **Unit labels** to see each unit's QR code and status. Editing can change the name, photo, and quantity. Increasing quantity generates new labels. Decreasing quantity retires the highest-numbered available units first. Return all checked-out units before deleting a group. Deleted labels stop working, and historical loans remain readable.
4. **Borrow** · Scan the unit label or enter its full Unit ID. Enter a borrower name, student ID, and return date. An already borrowed unit stays unavailable even when another unit in its group is available.
5. **Loans** · Return a unit in **Active**, then find its borrower, due date, and actual return time in **History**.
6. The orange light and dark palettes follow the device's appearance setting.

## Existing installations

The app upgrades the existing IndexedDB database in place. The old equipment QR now identifies **Unit 1**. Other units receive fresh labels. Since the old records did not track physical units, active legacy loans are assigned to distinct new units in checkout order. Reconcile labels with the actual items in circulation. Previously returned loans without an individual ID show as legacy group loans.

Data and photos belong to one installation. Clearing app storage or uninstalling removes them. To update an Android installation in place, use the same application ID and signing key. Use fictional student information in demos.

## Source map

| Area | Files | Responsibility |
| --- | --- | --- |
| App entry and navigation | `src/main.ts`, `src/app/app.component.*`, `src/app/app.routes.ts` | Angular bootstrap, shared layout, and routes |
| Screens | `src/app/pages/` | A folder for each feature with its page and HTML template |
| Admin PIN | `src/app/core/admin/` | Admin session and route guard |
| Local database | `src/app/core/inventory/` | Equipment groups, units, loans, photos, migration, and atomic writes |
| Shared UI and media | `src/app/shared/`, `src/global.css` | Unit labels, equipment photos, camera and QR functions, and global styles |
| Native host | `android/` | Android Studio project, Gradle wrapper, and MediaStore downloads |

The `equipment` store contains group information. The `units` store has a unique ID for every physical unit. `loans` stores the checked-out unit ID, original equipment details, borrower, and dates. `photos` stores JPEG blobs separately. Checkout verifies a unit and inserts its loan in the same transaction. Returns mark the loan as returned so the unit is immediately available again.

## Phone acceptance checks

| Try this on Android | Expected |
| --- | --- |
| Enter a wrong PIN, then 2026. Lock admin and open Add again. | Only the correct PIN unlocks inventory management. Locking restores the PIN prompt. |
| Add two balls with a photo and download both PNGs. | The labels have different IDs and files. Scan them from paper or a second screen. |
| Scan unrelated or unknown codes, deny camera access, then use manual entry. | Invalid codes are rejected and manual entry still works. |
| Borrow the first ball and scan it again. Then scan the second ball. | The first is blocked while the second can be borrowed independently. |
| Try deleting a group with an active loan. Return all units and then delete it. | Active loans block deletion. After deletion, historical loans stay visible. |
| Toggle Android's system appearance, then close and reopen the app. | The app follows the system theme and saved records persist. |
| Repeat checkout and return in airplane mode. | Existing labels, records, and photos are available locally. |
