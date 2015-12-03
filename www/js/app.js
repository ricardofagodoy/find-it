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
    cardStatus = 0,  // 0: transition  1: maze  2: lose
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
        
        // When flip is done - callback
        cardInfo.on('flip:done', flipDoneCallback);

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
            
            // Load "first" level
            loadLevel(currentLevel);
            
            // Resets timer - ready to play!
            resetTimer(); 
            
            // Position correctly level indicator
            levelInfo.html(currentLevel);
            levelInfo.css('top', (windowHeight/2 - levelInfo.height()/2) + 'px');
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
    });
    
    console.log('Transition screen callbacks loaded!');
}

function flipDoneCallback () {
        
    switch (cardStatus) {
    
        // If it's flipping from transition to maze
        case 0:
            // Let's start game for real!
            startLevel();
                
            // TODO: UPDATE TRANSITION TEXT
        
            cardStatus = 1;
        break;
            
        // If its moving from maze to transition
        case 1:
            // Load next level
            loadLevel(currentLevel);
            
            cardStatus = 0;
        break;
            
        case 2:
            
        break;
    }
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
    
    // Initialize jquery maphilight to current maze
    mazeTarget.maphilight(mapHighlightProps);
    
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
    
    console.log('Lose level {0}'.format(currentLevel));
    
    // Paints screen in red
    cardInfo.css('background-color', 'rgba(255, 0, 0, 0.5)');
    
    // Remove solution from maze
    mazeMapTarget.find('area').remove();
    
    // Prevent user of clicking many times
    removeMapClickEvents();
    
    // Cleans and resets timer
    resetTimer();
    
    // Wait until flip
    setTimeout(function() {
        
        // Clear level number during transition
        levelInfo.hide();
        
        // You lose when flip ends!
        cardStatus = 2;
        
        // Flips to next level (already preloaded)
        cardInfo.flip('toggle');
        
    }, 2000); 
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
