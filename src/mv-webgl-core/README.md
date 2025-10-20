# mv-webgl-core

Mackevision WebGL Core project.

## Included Commands

|Command|Description|
|--|--|
|`npm run build`| Build the app. Your built files are in the /dist folder. |
|`npm run test`| Run unit tests in the browser |
|`npm run test:headless`| Run unit tests in the headless browser |
|`npm run lint`| Run tslint to check if the code is formatted correctly |
|`npm run lint:fix`| Run tslint to format  the code correctly |
|`npm run prettier`| Run prettier to format the code correctly |
|`npm run prettier:check`| Run prettier to check if the code is formatted correctly |
|`npm run docs`| Run typedoc to build documentation. Your doc files are in the /docs folder. |
|`npm run graph`| Run madge to build a dependecie graph. Your graph.png file is in the /docs folder. |
|`npm run watch`| Run webpack dev server to serve our playground with hot reload. |

## Install Instructions
#### SourceTree
For the included pre-commit hooks for linting to work when using SourceTree on Mac: Make sure to start SourceTree via the Terminal using the command:
```
open /Applications/SourceTree.app/Contents/MacOS/SourceTree
``` 

## Test Setup

1. Runner: Karma
2. Testing framework: Jasmine
3. Mocking framework: Sinon

### Better Test Debuging
If you are getting test errors which not can be debugged, try to change the reportError function in Karma to this:
`node_modules/karma/lib/server.js`
```javascript
const reportError = (error) => {
      process.emit('infrastructure_error', error)
      disconnectBrowsers(1)
      this.log.error(error);
    }
```

## VanillaJS Build
1. Any changes that have been made to `playground/src/porsche/porsche-demo.ts` have to be translated to native js and pasted over to `vanilla-js-sandbox/src/porsche/porsche-demo.js`. Make sure that all imports, type declarations are removed and that the variable `assetsBaseUrl` is set correctly.
2. Run `npm run build:vanillajs`
3. VanillaJs can be found at `vanilla-js-sandbox/dist/porsche`
4. Create a zip with the build and the assets. Make sure that the assets are located in the folder defined with the variable `assetsBaseUrl`.


## Docs

TBD

## Graph

For creating a graph you need to install [Graphviz](https://www.graphviz.org/). It´s an open source graph visualization software which
 is require by building a png out of our dependency graph.
 
#### How to install Graphviz
 
For Windows install [Graphviz Windows](https://graphviz.gitlab.io/_pages/Download/Download_windows.html)

For other systems please have a look at all [packages](https://graphviz.gitlab.io/download/)

####  Add Graphviz to env
After installation you need to add Graphviz to your env:  

Windows: Add `C:\Program Files (x86)\Graphviz2.38\bin;` to your path
