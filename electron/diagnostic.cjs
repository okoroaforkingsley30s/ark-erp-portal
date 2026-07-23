const { app, BrowserWindow } = require("electron");
const path = require("path");

let diagnosticWindow;

process.on("uncaughtException", error => {
    console.error("[ARK-DIAG][MAIN-UNCAUGHT]", error);
});

process.on("unhandledRejection", error => {
    console.error("[ARK-DIAG][MAIN-REJECTION]", error);
});

app.whenReady().then(async () => {
    diagnosticWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        show: true,
        backgroundColor: "#08153d",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            devTools: true
        }
    });

    const contents = diagnosticWindow.webContents;
    const target = path.resolve(__dirname, "../dist/index.html");

    console.log("[ARK-DIAG][TARGET]", target);

    contents.on("console-message", (_event, ...details) => {
        console.log("[ARK-DIAG][RENDERER-CONSOLE]", ...details);
    });

    contents.on("did-fail-load", (_event, code, description, url) => {
        console.error("[ARK-DIAG][LOAD-FAILED]", {
            code,
            description,
            url
        });
    });

    contents.on("render-process-gone", (_event, details) => {
        console.error("[ARK-DIAG][RENDERER-GONE]", details);
    });

    contents.on("preload-error", (_event, preloadPath, error) => {
        console.error("[ARK-DIAG][PRELOAD-ERROR]", preloadPath, error);
    });

    contents.on("did-finish-load", () => {
        console.log("[ARK-DIAG][LOAD-FINISHED]", contents.getURL());

        setTimeout(async () => {
            try {
                const state = await contents.executeJavaScript(`
                    JSON.stringify({
                        href: location.href,
                        title: document.title,
                        readyState: document.readyState,
                        rootExists: Boolean(document.getElementById("root")),
                        rootLength: document.getElementById("root")?.innerHTML.length || 0,
                        bodyText: document.body?.innerText?.slice(0, 300) || "",
                        images: Array.from(document.images).map(image => ({ src: image.src, complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, display: getComputedStyle(image).display, visibility: getComputedStyle(image).visibility, width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height })), scripts: Array.from(document.scripts).map(script => script.src)
                    })
                `);

                console.log("[ARK-DIAG][PAGE-STATE]", state);
            }
            catch (error) {
                console.error("[ARK-DIAG][PAGE-INSPECTION-FAILED]", error);
            }
        }, 2000);
    });

    await diagnosticWindow.loadFile(target);
    contents.openDevTools({ mode: "detach" });
});