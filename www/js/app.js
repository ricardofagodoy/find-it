$(document).on("deviceready", function() {
    init();
});

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
    currentLevel = 0;
    
function init() {

    console.log('Starting to init...');
    
    // Get window size
    windowWidth = $(window).width();
    windowHeight = $(window).height();
    
    console.log(windowHeight);
    
    // Sets my body to fit in all screen!
    $('body').width(windowWidth).height(windowHeight);
    
    // Hide splashscreen
    navigator.splashscreen.hide();
    
    // Initilize fast click to prevent click delay
    Origami.fastclick(document.body);
    
    // Load main menu
    loadMainMenu();
    
    // TODO: Load level which user saved
    currentLevel = 1;
    
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
        cardInfo.flip({trigger: 'manual', speed: 600});
        
        // When flip is done, is safe to load another level
        cardInfo.on('flip:done', function () {
            // Preload next level
            loadLevel(currentLevel + 1);
        });

        // Can't scroll mazes
        cardInfo.on('touchmove', function(e) { e.preventDefault(); }, false);

        // Load both-sides levels to start
        loadLevel(currentLevel);
        loadLevel(currentLevel + 1);        
    });
    
    console.log('Init method reached its end');
}

function loadMainMenu() {
    
    console.log('Loading main menu (adding listeners)...');
    
    var menu = $('#menu');
    
    menu.find('#options #play').on('click', function(event) {
        
        menu.fadeOut("slow", function() {
            
            // Resets timer - ready to play!
            resetTimer();
            
            // Slowly shows maze
            $('#mazes').fadeIn("slow");
            
            // Position correctly level indicator
            levelInfo.html(currentLevel);
            levelInfo.css('top', (windowHeight/2 - levelInfo.height()/2) + 'px');
            
            startPreloadedCurrentLevel();
        }); 
        
    });
    
    console.log('Main Menu loaded!');
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
    
    // Remove previous area
    mazeMapTarget.find('area').remove();
    
    // Position to correct click
    var area = $('<area>', {
        shape: 'poly',
        coords: levelProps.coords.map(function(value, index) {
            return Math.floor(index%2 ? value/heightScale : value/widthScale);
        }).join(', ')
    }).appendTo(mazeMapTarget);
    
    console.log('Level {0} loaded with success!'.format(level));
}

function winCurrentLevel(element) {
    
    console.log('Victory level {0}'.format(currentLevel));
    
    // Prevent user of clicking many times
    removeMapClickEvents();
    
    // Cleans and resets timer
    resetTimer();
    
    // Win the game!
    if(currentLevel == maxLevel) {
        console.log('Player win last level!');
        alert('You win! :)');
        return;
    }
    
    console.log('Upgrading level - going to: {0}'.format(currentLevel+1));
    currentLevel++;
    
    // Wait until flip
    setTimeout(function() {
        
        // Clear green painting
        $(element).trigger('cleanAll');
        
        // Clear level number during transition
        levelInfo.hide();
        
        // Flips to next level (already preloaded)
        cardInfo.flip('toggle');
        
        // Start new current level
        startPreloadedCurrentLevel();
        
    }, 500); 
} 

function loseCurrentLevel() { 
    console.log('Lose');
}

function startPreloadedCurrentLevel() {
      
    console.log('Starting preloaded level {0}...'.format(currentLevel));
    
    // Update and show level information
    levelInfo.html(currentLevel);
    levelInfo.show();
        
    // Add click events
    addMapClickEvents();
    
    // Start timer for current level
    startTimer(levels[currentLevel-1].timer);
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
    
    /* timerInfo.animate({
        top: '0'
    },{
        duration: seconds*1000,
        complete: function() {
            timerInfo.css('background-color', 'red');
            loseCurrentLevel();
        }
    }); */
}

function resetTimer() {
    
    console.log('Reseting timer...');
    
    // Prevents timer to animate when reseting
    timerInfo.css('transition-property', 'none');
    
    // Pull back up the div
    timerInfo.css('top', -windowHeight + 'px');
    
    // Set background to original colors
    timerInfo.css('background-color', timerColor);
    
    // Turn off callback when animation is completed (not needed when reseting)
    timerInfo.off('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd');
    
    // timerInfo.removeAttr('style');
}

function addMapClickEvents() {

    var mazeTarget = mazeElements[currentLevel%2],
        mazeMapTarget = mazeMapElements[currentLevel%2];
        
    console.log('Binding maze {0} vclick events...'.format(mazeTarget.attr('id')));
        
    // Initialize jquery maphilight to current maze
    mazeTarget.maphilight(mapHighlightProps);
    
    // Click on correct position: win
    $('#{0} area'.format(mazeMapTarget.attr('id'))).bind('click', function (event) {
        winCurrentLevel(this);
    }); 
    
    // Click anywhere else: lose
    cardInfo.bind('click', function(event) { 
        if(event.target.nodeName != 'AREA')
            loseCurrentLevel();
    });   
}

function removeMapClickEvents() {
    
    var mazeTarget = mazeElements[currentLevel%2],
        mazeMapTarget = mazeMapElements[currentLevel%2];
    
    console.log('Unbinding maze {0} vclick events...'.format(mazeTarget.attr('id')));
        
    $('#{0} area'.format(mazeMapTarget.attr('id'))).unbind('click');
    cardInfo.unbind('click');
}
