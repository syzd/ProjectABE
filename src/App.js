import { Model, IController } from './lib/mvc.js';
import IStore  from './store/IStore.js';
import DOM from './lib/dry-dom.js';

window.strldr = require("./lib/strldr.js");

let controllers = {};

class App {

    static "@inject" = {
        DOM:DOM,
        store:IStore,
        pool:"pool",
        controllers:[IController,[]],
        root: [Model, {scope:"root"}],
	//plugins: ["Plugin",[]]
    }

    keySequences = {
	'Konami':[
	    'ArrowUp', 'ArrowUp',
	    'ArrowDown', 'ArrowDown',
	    'ArrowLeft', 'ArrowRight',
	    'ArrowLeft', 'ArrowRight',
	    'KeyA', 'KeyB'
	]
    }

    activeSequences = []

    iemap = {
	"Up":"ArrowUp",
	"Down":"ArrowDown",
	"Left":"ArrowLeft",
	"Right":"ArrowRight",
	"Alt":"AltLeft",
	"CONTROL":"ControlLeft"
    }

    gamepadmap = {
	0:"ControlLeft",
	1:"AltLeft",
	2:"ControlLeft",
	3:"AltLeft",
	12:"ArrowUp",
	15:"ArrowRight",
	13:"ArrowDown",
	14:"ArrowLeft"	
    }

    unblockable = {
	"F6":true,
	"F7":true,
	"F8":true
    }

    mappings = {
    }
    
    constructor(){

        window.store = this.store;

        this.pool.add(this);

        this.models = [];

        this.store.onload = this.init.bind(this);

    }

    remapKey( i, o ){
	if( i && typeof i == "object" ){
	    for( let k in i )
		this.mappings[k] = i[k];
	    return;
	}
	this.mappings[i] = o;
    }

    init(){
	/*
	this.plugins.forEach( p => {
	    this.pool.add(p);
	});
	*/

	this.initKeyboard();
	this.initControllers();

        this.pool.call("enterSplash");

        setInterval( this.commit.bind(this), 3000 );

        var pending = 2, dropFile = event => {
	    this.pool.call("onDropFile", new DOM(event.target), event);
	};

        this.openModel( "app", done.bind(this) );
        setTimeout( done.bind(this), 1000 );

	window.addEventListener("resize", _ => this.pool.call("onResizeWindow"));
	document.body.addEventListener("dragenter", cancelEvent);
	document.body.addEventListener("dragover", cancelEvent);
	document.body.addEventListener("drop", dropFile);

	function cancelEvent( event ){
	    event.stopPropagation();
	    event.preventDefault();
	}
	
        function done(){
            pending--;
            if( !pending )
                this.pool.call( "exitSplash" );

        }

    }

    initControllers(){

	controllers = {};

	let connecthandler = e => {
	    controllers[e.gamepad.index] = {gamepad:e.gamepad, state:{}};
	};

	let disconnecthandler = e => {
	    delete controllers[e.gamepad.index];
	};

	window.addEventListener("gamepadconnected", connecthandler);
	window.addEventListener("gamepaddisconnected", disconnecthandler);
	
    }

    onPollTickListeners( list ){
	list.push(this);	
    }

    tick(){

	Array.from((navigator.getGamepads || navigator.webkitGetGamepads || (_=>[])).call(navigator))
	    .filter( gp => !!gp )
	    .reduce( (c, gp) => {
		if( c[gp.index] ) c[gp.index].gamepad = gp;
		else c[gp.index] = {gamepad:gp, state:{}};
		return c;
	    }, controllers);	
	
	for( let k in controllers ){
	    let {gamepad, state} = controllers[k];

	    let upDown = gamepad.axes[1],
		leftRight = gamepad.axes[0];

	    if( upDown < -0.5 ) upDown = -1;
	    else if( upDown > 0.5 ) upDown = 1;
	    else upDown = 0;
	    
	    if( leftRight < -0.5 ) leftRight = -1;
	    else if( leftRight > 0.5 ) leftRight = 1;
	    else leftRight = 0;

	    if( upDown != state.upDown ){

		if( state.upDown < 0 )
		    this.inputUp("ArrowUp");
		else if( state.upDown > 0 )
		    this.inputUp("ArrowDown");
		
		state.upDown = upDown;
		
		if( upDown < 0 ) this.inputDown("ArrowUp");
		else if( upDown > 0 ) this.inputDown("ArrowDown");

	    }

	    if( leftRight != state.leftRight ){

		if( state.leftRight < 0 )
		    this.inputUp("ArrowLeft");
		else if( state.leftRight > 0 )
		    this.inputUp("ArrowRight");
		
		state.leftRight = leftRight;
		
		if( leftRight < 0 ) this.inputDown("ArrowLeft");
		else if( leftRight > 0 ) this.inputDown("ArrowRight");

	    }
	    
	    for( let i in this.gamepadmap ){
		let pressed = gamepad.buttons[i];
		
		if( typeof pressed == "object" )
		    pressed = pressed.pressed;
		else pressed = pressed >= 0.5;
		
		if( pressed != state[i] ){
		    state[i] = pressed;

		    if( pressed ) this.inputDown( this.gamepadmap[i] );
		    else this.inputUp( this.gamepadmap[i] );

		}
	    }
	}
	
    }

    inputDown( code ){
	code = this.mappings[ code ] || code;
	for( let i=0; i<this.activeSequences.length; ++i ){
	    let obj = this.activeSequences[i];
	    let next = obj.seq[ obj.pos++ ];
	    
	    if( next !== code || obj.pos >= obj.seq.length ){
		if( next == code )
		    this.pool.call( obj.name );
		this.activeSequences.splice(i--, 1);
	    }
	}

	for( let k in this.keySequences ){
	    let seq = this.keySequences[k];
	    if( seq[0] == code )
		this.activeSequences.push({
		    name:k,
		    pos:1,
		    seq
		});
	}
	
	return this.pool.call("onPress" + code );	
    }

    inputUp( code ){
	return this.pool.call("onRelease" + (this.mappings[ code ] || code) );
    }

    initKeyboard(){
	
	document.body.addEventListener("keydown", evt => {

	    let code = evt.code;
	    if( code === undefined ) code = this.iemap[ evt.key ] || ("Key" + evt.key.toUpperCase());

	    if( (evt.target.tagName == "INPUT" || evt.target.tagName == "TEXTAREA") && !this.unblockable[code] )
		return;

	    let ret = this.inputDown( code );
	    if( ret === true ){
		evt.preventDefault();
		evt.stopPropagation();
	    }
		
	});

	document.body.addEventListener("keyup", evt => {

	    let code = evt.code;
	    if( code === undefined ) code = this.iemap[ evt.key ] || ("Key" + evt.key.toUpperCase());

	    if( (evt.target.tagName == "INPUT" || evt.target.tagName == "TEXTAREA") && !this.unblockable[code] )
		return;

	    let ret = this.inputUp( code );
	    if( ret === true ){
		evt.preventDefault();
		evt.stopPropagation();
	    }
	});

        this.controllers.forEach((controller) => {
            this.pool.add( controller );
        });
	
    }

    openModel( name, cb, model ){

        var oldModel = this.models.find((obj) => obj.name == name );

        if( oldModel ){

            if( oldModel == model ) return;
            this.closeModel( name );

        }

        var path = name;

        if( typeof model == "string" ){
            path = model;
            model = null;
        }

        if( !model ) model = new Model();

        this.root.setItem( name, model.data );

        this.models[ this.models.length ] = {
            model,
            name,
            path,
            dirty: false
        };

        this.store.getTextItem( path, (data)=>{

	    let onGetModel = data => {

		if( data ){
		    
		    model.load( data );
		    if( model.getItem("color") === undefined )
			model.setItem("color", Math.random()*10 | 0);

		    if( model.version === 1 ){
			model.dirty = false;
			cb.call();
			return;
		    }

		    model.setItem("version", 1);

		    model.setItem("color", Math.random()*10 | 0);
		    
		}else if( model.getItem("color") === undefined )
		    model.setItem("color", Math.random()*10 | 0);

		
		this.pool.call( name + "ModelInit", model, cb );
		
	    };

            if( data ){
		try{
		    data=JSON.parse(data);
		}catch(ex){
		    data=null;
		}
	    }

	    if( !data || !Array.isArray(data) )
		return onGetModel( data );

	    let map = {}, pending = data.length;

	    data.forEach( de => {

		this.store.getTextItem( path + "/" + de, item => {
		    if( typeof item == 'string' )
			map[de] = JSON.parse(item);
		    
		    pending--;
		    if( !pending )
			onGetModel( map );
		    
		});
		
	    });

        });

    }

    closeModel( name ){
        // to-do: find, commit, remove from this.models
    }

    appModelInit( model, cb ){

	let repoURLs = model.getModel("repoList");

	model.setItem("proxy", this.root.getItem("proxy", ""));

	if( !repoURLs )
	    model.setItem("repoList", {
		Eried:"http://arduboy.ried.cl/repo.json",
		Crait:"http://www.crait.net/arduboy/repo2.json",
		TeamARG:"repo.json"
	    });
	
	cb();
	
    }

    commit(){

        for( var i = 0; i < this.models.length; ++i ){

            var obj = this.models[i];
            if( !obj.dirty && obj.model.dirty ){

                obj.dirty = true;
                obj.model.dirty = false;

            }else if( obj.dirty && !obj.model.dirty ){

                obj.dirty = false;
                // this.store.setItem( obj.path, JSON.stringify(obj.model.data) );
		this.store.setItem( obj.path, JSON.stringify( Object.keys(obj.model.data) ) );
		for( let k in obj.model.data ){
		    this.store.setItem( obj.path + "/" + k, JSON.stringify( obj.model.data[k] ) );
		}

            }else if( obj.dirty && obj.model.dirty ){

                obj.model.dirty = false;

            }

        }

    }

    setActiveView( view ){
        [...this.DOM.element.children].forEach( node => node.parentElement.removeChild(node) );
    }

}


export default App;
