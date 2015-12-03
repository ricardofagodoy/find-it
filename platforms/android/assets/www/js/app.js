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
    mazeActive = 1, 
    mazeTarget = null,
    mazeMapTarget = null,
    levelInfo = null,
    timerInfo = null,
    cardInfo = null,
    currentLevel = 0;
    
function init() {

    console.log('Starting to init...');
    
    // Get window size
    windowWidth = $(window).width();
    windowHeight = $(window).height();
    
    // Sets my body to fit in all screen!
    $('body').width(windowWidth).height(windowHeight);
    
    // Hide splashscreen
    navigator.splashscreen.hide();
    
    // Initilize fast click to prevent click delay
    Origami.fastclick(document.body);
    
    // TODO: Load level which user saved
    currentLevel = 1;
    
    // Reference DOM elements to easy access
    mazeTarget = $('#maze');
    mazeMapTarget = $('#mazemap');
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
        
        // Load main menu
        configureMainMenuEvents();

        // Load transition screen
        configureTransitionEvents();
        
        // Set up flip to work manually
        cardInfo.flip({trigger: 'manual', speed: 1000});
        
        // When flip is done, is safe to load another level
        cardInfo.on('flip:done', function () {
            
            // If it's flipping from transition to maze
            if (mazeActive) {
                
                // TODO: UPDATE TRANSITION TEXT
                
            } else {
                
                // Load next level
                loadLevel(currentLevel);
            }
            
            mazeActive = !mazeActive;
        });

        // Can't scroll mazes
        cardInfo.on('touchmove', function(e) { e.preventDefault(); }, false);      
    });
    
    console.log('Init method reached its end');
}

function configureMainMenuEvents() {
    
    console.log('Loading main menu (adding listeners)...');
    
    var menu = $('#menu');
    
    menu.find('#options #play').on('click', function(event) {
        
        menu.fadeOut("slow", function() {
            
            // Slowly cards
            $('#mazes').fadeIn("slow");
            
            // Resets timer - ready to play!
            resetTimer(); 
            
            // Position correctly level indicator
            levelInfo.html(currentLevel);
            levelInfo.css('top', (windowHeight/2 - levelInfo.height()/2) + 'px');
            
            // Load "first" level
            loadLevel(currentLevel);
        }); 
        
    });
    
    console.log('Main Menu loaded!');
}

function configureTransitionEvents() {
    
    console.log('Loading transition (adding listeners)...');
    
    var transition = $('#transition');
    
    transition.find('#options #play').on('click', function(event) {
        
        // Flips card to maze side
        cardInfo.flip('toggle');
        
        // Let's start game for real!
        startLevel();
    });
    
    console.log('Transition screen callbacks loaded!');
}

function loadLevel(level) {
    
    console.log('Starting to load level {0}...'.format(level));
    
    var levelProps = levels[level-1];
    
    // If level does not exist (error)
    if(levelProps == undefined) {
        console.log('Invalid level: {0}'.format(level));
        return;
    }
    
    console.log('About to load {0}...'.
                format(imageFilesPath.format(level)));
    
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

function winLevel(element) {
    
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
        
    }, 1000); 
} 

function loseLevel() { 
    console.log('Lose');
}

function startLevel() {
      
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
            loseLevel();
        });    
    
    /* timerInfo.animate({
        top: '0'
    },{
        duration: seconds*1000,
        complete: function() {
            timerInfo.css('background-color', 'red');
            loseLevel();
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
        
    console.log('Binding maze click events...');
        
    // Initialize jquery maphilight to current maze
    mazeTarget.maphilight(mapHighlightProps);
    
    // Click on correct position: win
    $('#mazemap area').bind('click', function (event) {
        winLevel(this);
    }); 
    
    // Click anywhere else: lose
    cardInfo.bind('click', function(event) { 
        if(event.target.nodeName != 'AREA')
            loseLevel();
    });   
}

function removeMapClickEvents() {
    
    console.log('Unbinding maze click events...');
        
    $('#mazemap area').unbind('click');
    cardInfo.unbind('click');
}
