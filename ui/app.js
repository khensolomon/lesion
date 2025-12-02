// Use the traditional GJS imports instead of ES6 modules
const Adw = imports.gi.Adw;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;

// Find the current directory to locate the .ui file
const currentDir = GLib.get_current_dir();
const uiFile = GLib.build_filenamev([currentDir, 'window.ui']);

// Define the Window class, linking it to our UI file
const ExampleWindow = GObject.registerClass({
    GTypeName: 'ExampleWindow',
    // Use the dynamically found path to the UI file
    Template: 'file://' + uiFile,
}, class ExampleWindow extends Adw.ApplicationWindow {
    constructor(kwargs) {
        super(kwargs);
    }
});


// Define the main Application class
const MyApp = GObject.registerClass({
    GTypeName: 'MyApp',
}, class MyApp extends Adw.Application {
    constructor() {
        super({
            application_id: 'com.example.MyApp',
            flags: imports.gi.ApplicationFlags.FLAGS_NONE,
        });
    }

    // vfunc_activate is the virtual function that gets called when the application starts.
    vfunc_activate() {
        // Create an instance of our window and show it
        this.active_window = new ExampleWindow({ application: this });
        this.active_window.present();
    }
});

// Create an instance of the app and run it, passing command-line arguments
const app = new MyApp();
app.run(imports.system.args);

