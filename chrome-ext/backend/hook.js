if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  console.log('React Developer Tools must be installed for React Scope');
}
// added code for version 16 or lower
var devTools = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
var reactInstances = devTools._renderers;
var rid = Object.keys(reactInstances)[0];
var reactInstance = reactInstances[rid];
var fiberDOM;
var currState;
var initialState;
var reduxStore15;
var runFifteen = false;

// get initial state and only run once
function getInitialStateOnce() {
  // console.log("getInitialStateOnce is running")
  let run = false;
  return function getInitialState() {
    if (!run) {
      // grab initial state
      let initStateSet = devTools._fiberRoots[rid];
      initStateSet.forEach((item) => {
        initialState = item;
      });
      // parse state
      initialState = checkReactDOM(initialState.current.stateNode);
      run = true;
    }
  };
}

// set initial state
var setInitialStateOnce = getInitialStateOnce();
(function setInitialState() {
  if (reactInstance && reactInstance.version) {
    // get initial state for 16 or higher
    // console.log("setInitial State is running ")
    setInitialStateOnce();
    setTimeout(() => {
      // saveCache.addToHead(initialState); //move this step to devtools.js instead
      // console.log('initial state: ', initialState)
      transmitData(initialState);
    }, 100);
  } else if (reactInstance && reactInstance.Mount) {
    // get intiial state for 15
    // console.log('getting intial state for 15')
    getFiberDOM15();
  } else {
    // console.log("React Dev Tools is not found")
  }
}());


// convert data to JSON for storage
function stringifyData(obj) {
  let box = [];
  let data = JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (box.indexOf(value) !== -1) {
          return;
        }
        box.push(value);
      }
      return value;
    }));
  box = null;
  return data;
}

// Monkey patch to listen for state changes
(function connectReactDevTool() {
  // console.log('entering connect ReactDevTool')
  // for react16 or 16+
  if (reactInstance.version) {
    devTools.onCommitFiberRoot = (function (original) {
      return function (...args) {
        getFiberDOM16(args[1]);
        return original(...args);
      };
    }(devTools.onCommitFiberRoot));
  } else if (reactInstance.Mount) {
    // lower than React 16
    reactInstance.Reconciler.receiveComponent = (function (original) {
      return function (...args) {
        if (!runFifteen) {
          runFifteen = true;
          setTimeout(() => {
            getFiberDOM15(); // here you are getting the data from the DOM
            runFifteen = false;
          }, 10);
        }
        return original(...args);
      };
    }(reactInstance.Reconciler.receiveComponent));
  }
}());

//for React 15
async function getFiberDOM15() {
  // console.log("getFiberDOM15 is running")
  try {
    currState = await parseData();
    // don't send if state is null
    transmitData(currState);
  } catch (e) {
    console.log(e);
  }
}

// parse data from React 15
async function parseData(components = []) {
  let root = reactInstance.Mount._instancesByReactRootID[1]._renderedComponent;
  traverseFifteen(root, components);
  // console.log(components)
  let data = { currentState: components };
  return data;
}

//for React 16+
async function getFiberDOM16(instance) {
  // console.log("getFiberDOM16 is running")
  try {
    fiberDOM = await instance;
    currState = await checkReactDOM(fiberDOM);
    // console.log(currState)
    // saveCache.addToHead(currState); move this step to devtools.js instead 
    transmitData(currState);
  } catch (e) {
    console.log(e);
  }
}

//Parse Data for React 16+
function checkReactDOM(reactDOM) {
  // console.log("checkReactDOM is running")
  let data = { currentState: null };
  let cache = [];
  if (reactDOM) {
    // console.log(reactDOM.current);
    traverseComp(reactDOM.current, cache); // maybe there is no need to use stateNode.current
  } else {
    return;
  }
  data.currentState = cache;
  // console.log('Store with Hierarchy: ', data);
  return data;
}



//All the traversing algorithims below
// traverse React 15
function traverseFifteen(node, cache) {
  let targetNode = node._currentElement;
  if (!targetNode) {
    return;
  }
  let component = {
    name: '',
    state: null,
    props: null,
    children: {},
  };

  if (targetNode.type) {
    if (targetNode.type.name) {
      component.name = targetNode.type.name;
    } else if (targetNode.type.displayName) {
      component.name = targetNode.type.displayName;
    } else {
      component.name = targetNode.type;
    }
  }

  // redux


  // State
  if (node._instance && node._instance.state) {
    if (component.state === {}) {
      component.state = null;
    }
    else {
      component.state = node._instance.state
    }
  }

  // props
  if (targetNode && targetNode.props) {
    let props = [];
    if (typeof targetNode.props === 'object') {
      let keys = Object.keys(targetNode.props);
      keys.forEach((key) => {
        props.push(targetNode.props);
      });
      component.props = props;
    } else {
      component.props = targetNode.props;
    }
  }

  // entering the children components recursively
  let children = node._renderedChildren;
  component.children = []; //becomes a new parameter as an empty array for the recursion
  cache.push(component)
  if (children) {
    let keys = Object.keys(children);
    keys.forEach((key) => {
      traverseFifteen(children[key], component.children);
    });
  } else if (node._renderedComponent) {
    traverseFifteen(node._renderedComponent, component.children);
  }
}

// traverse React 16 fiber DOM
function traverseComp(node, cache) {
  // LinkedList Style
  let component = {
    name: '',
    state: null,
    props: null,
    children: [],
  };
  
  if (node.type) {
    if (node.type.name) {
      component.name = node.type.name;
    } else {
      component.name = node.type || 'Default';
    }
  }

  if (node.memoizedState) {
    component.state = node.memoizedState;
  }

  // redux store


  if (node.memoizedProps) {
    let props = [];
    if (typeof node.memoizedProps === 'object') {
      let keys = Object.keys(node.memoizedProps);
      keys.forEach((key) => {
        props.push(node.memoizedProps[key]);
      });
      // need to parse the props if it is a function or an array or an object
      component.props = props[0] || props;
    } else {
      component.props = node.memoizedProps;
    }
  }
  component.children = [];
  cache.push(component)
  if (node.child !== null) {
    traverseComp(node.child, component.children);
  }
  if (node.sibling !== null) {
    traverseComp(node.sibling, cache);
  }
}


