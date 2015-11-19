var deviceReadyDeferred = $.Deferred();
var jqmReadyDeferred = $.Deferred();

$(document).on("deviceready", function() {
  deviceReadyDeferred.resolve();
});

$(document).on("mobileinit", function () {
  jqmReadyDeferred.resolve();
});

$.when(deviceReadyDeferred, jqmReadyDeferred).then(init);

// Format string function
if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

//$(function() { init(); });

var propertiesDeffered = $.Deferred(),
    windowWidth = 0,
    windowHeight = 0,
    imageFilesPath = '',
    widthScale = 0,
    heightScale = 0,
    maxLevel = 0,
    timerColor = '',
    properties = {},
    messages = {},
    levels = {},
    mapHighlightProps = {},
    mazeElements = null,
    mazeMapElements = null,
    levelInfo = null,
    timerInfo = null,
    cardInfo = null,
    currentLevel = 1;
    
function init() {
    
    // Hide splashscreen
    navigator.splashscreen.hide();

    // Get window size
    windowWidth = $(window).width();
    windowHeight = $(window).height();
    
    console.log('Starting to init...');
    
    // Reference DOM elements to easy access
    mazeElements = [$('#maze-second'), $('#maze-first')];
    mazeMapElements = [$('#mazemap-second'), $('#mazemap-first')];
    levelInfo = $('#levelInfo');
    timerInfo = $('#timerInfo');
    cardInfo = $("#card");
    
    // Load general properties
    $.getJSON('conf/properties.json').done(function (json) {
        
        console.log('Properties loaded: {0}'.format(JSON.stringify(json)));
        
        messages = json['messages'];
        levels = json['levels'];
        
        maxLevel = json['maxLevel'];
        mapHighlightProps = json['mapHighlightProps'];
        imageFilesPath = json['imageFilesPath'];
        timerColor = json['timerColor'];
        
        widthScale = json['imageWidth'] / windowWidth;
        heightScale = json['imageHeight'] / windowHeight;
        
        propertiesDeffered.resolve();
        
    }).fail(function(e) {
        alert('Severe internal error: ' + e.status);
    });

    // When it's loaded, bring up menu and load levels
    $.when(propertiesDeffered).done(function() {
        
        console.log('Starting properties loaded callback...');
        
        // Set up flip to work manually
        cardInfo.flip({trigger: 'manual', speed: 1500});

        // Can't scroll mazes
        cardInfo.on('touchmove', function(e) { e.preventDefault(); }, false);

        // Set up number informing current level
        levelInfo.html(currentLevel);
        levelInfo.css('top', (windowHeight/2 - levelInfo.height()/2) + 'px');

        // Set up timer color effect
        timerInfo.height(windowHeight);
        timerInfo.css('top', -windowHeight + 'px');
        timerInfo.css('background-color', timerColor);
        
        // Load level to start
        loadLevel(currentLevel);
        
        // TODO: menu goes here
        //alert('Press OK to start!');
        
        startPreloadedCurrentLevel();
    });
    
    console.log('Init method reached its end');
}

function loadLevel(level) {
    
    console.log('Starting to load level {0}...'.format(level));
    
    var levelProps = levels[level-1],
        
        // Define which IMG DOM element to load on
        mazeTarget = mazeElements[level%2],
        mazeMapTarget = mazeMapElements[level%2];
    
    // If level does not exist (error)
    if(levelProps == undefined) {
        console.log('Invalid level: {0}'.format(level));
        return;
    }
    
    console.log('About to load {0} on DOM ID {1}'.
                format(imageFilesPath.format(level),
                mazeTarget.attr('id')));
    
    // Load image from file
    mazeTarget.attr('src', imageFilesPath.format(level));
    
    // Fits image to use all screen size
    mazeTarget.width(windowWidth).height(windowHeight);
    
    // Position to correct click
    var area = $('<area>', {
        shape: 'poly',
        coords: levelProps.coords.map(function(value, index) {
            return Math.floor(index%2 ? value/heightScale : value/widthScale);
        }).join(', ')
    }).appendTo(mazeMapTarget);
    
    // Binds JQuery Maphighlight to image
    mazeTarget.maphilight(mapHighlightProps);  
     
    // Add click events
    setMapClickEvents(level, winCurrentLevel, loseCurrentLevel);
    
    console.log('Level {0} loaded with success!'.format(level));
}

function winCurrentLevel(element) {
    
    console.log('Victory level {0}'.format(currentLevel));
    
    // Prevent user of clicking many times
    setMapClickEvents(currentLevel);
    
    // Cleans and resets timer
    resetTimer();
    
    // Win the game!
    if(currentLevel == maxLevel) {
        console.log('Player win last level!');
        return;
    }
    
    console.log('Upgrading level - going to: {0}'.format(currentLevel+1));
    currentLevel++;
    
    //TODO: fix this
    setTimeout(function() {
        
        // Clear green painting
        $(element).trigger('mouseout');
        
        // Flips to next level (already preloaded)
        cardInfo.flip('toggle');
        
        startPreloadedCurrentLevel();
        
    }, 1000); 
}

function loseCurrentLevel() {
    // alert('Lose');
}

function startPreloadedCurrentLevel() {
      
    console.log('Starting preloaded level {0}...'.format(currentLevel));
    
    // Show level information
    levelInfo.html(currentLevel);
    levelInfo.show();
        
    // Start timer for current level
    startTimer(levels[currentLevel-1].timer);
    
    // Preload next level
    loadLevel(currentLevel + 1);
}

function startTimer(seconds) {

    console.log('Starting timer for {0} seconds...'.format(seconds));
    
    // Set new time for that level
    timerInfo.css('transition-duration', seconds + 's');
    
    // Set original transition property (top position)
    timerInfo.css('transition-property', 'top');
    
    // This starts the animation, bringing the div down to 0
    timerInfo.css('top', 0);
    
    // Callback when animation ends
    timerInfo.one('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd',
        function() {
            console.log('Timer animation ended: {0} seconds passed'.format(seconds));
        
            timerInfo.css('background-color', 'red');
            loseCurrentLevel();
        });    
}

function resetTimer() {
    
    console.log('Reseting timer...');
    
    // Prevents timer to animate when reseting
    timerInfo.css('transition-property', 'none');
    
    // Pull back up the div
    timerInfo.css('top', -windowHeight + 'px');
    
    // Set background to original colors
    timerInfo.css('background-color', timerColor);
}

function setMapClickEvents(level, correct, wrong) {

    var mazeTarget = mazeElements[level%2],
        mazeMapTarget = mazeMapElements[level%2];
    
    if(correct == undefined || wrong == undefined) {
        console.log('Unbinding maze {0} vclick events...'.format(mazeTarget.attr('id')));
        
        $('#{0} area'.format(mazeMapTarget.attr('id'))).unbind('vclick');
        mazeTarget.parent().unbind('vclick');
        
    } else {
        console.log('Binding maze {0} vclick events...'.format(mazeTarget.attr('id')));
        
        // Click on correct position: win
        $('#{0} area'.format(mazeMapTarget.attr('id'))).on('vclick', function (event) {
            correct(this);
        }); 

        // Click anywhere else: lose
        mazeTarget.parent().on('vclick', function(event) { 
            if(event.target.nodeName != 'AREA')
                wrong();
        });
    }
}