# [lcov](http://ltp.sourceforge.net/coverage/lcov/geninfo.1.php)-[sourcemap](https://github.com/mozilla/source-map/)

> Transform an LCOV file using sourcemaps.

This is a for of Tapad/lcov-sourcemap that includes fixes to increase compatibility with newer versions of sourcemap

---
## Wat?
* Run tests against transformed, concat'ed, etc. dist file
* Get code coverage per source file

---
## Install
Install with [npm](https://github.com/flowpl/lcov-sourcemap)

```
npm install --save-dev lcov-sourcemap-x
```

---
## Usage
```
var lcovSourcemap = require("lcov-sourcemap-x");
lcovSourcemap("./coverage/lcov-raw.info", {
	app: "./dist/js/app.js.map",
	others: "./dist/js/others.js.map"
}, "./src").then(function (lcov) {
    // lcov string
});

lcovSourcemap.writeLcov("./coverage/lcov-raw.info", {
	app: "./dist/js/app.js.map",
	others: "./dist/js/others.js.map"
}, "./src", "./coverage/lcov.info").then(function () {
    // Done!
});
```
### lcovSourcemap(lcovFilePath, sourcemaps, sourceDir)
* **lcovFilePath** (String): Lcov file.
* **sourcemaps** (Object | Array | String): Array or map of source map files or a string of one source map file.
* **sourceDir** (String): Source directory to look for files (checks for existence).
* _return_ (Promise): Promise containing Lcov string

### lcovSourcemap.writeLcov(lcovFilePath, sourcemaps, sourceDir, outputLcovFilePath)
* Arguments similar to `lcovSourceMap`
* **outputLcovFilePath** (String): Output lcov file path.
* _return_ (Promise): Resolves when write is complete
