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

var STATUS = { NEW: 'new', RESUME: 'resume', NEXT: 'next', LOSE: 'lose', WIN: 'win' };

var propertiesDeffered = null,
    windowWidth = 0,
    windowHeight = 0,
    imageFilesPath = '',
    widthScale = 0,
    heightScale = 0,
    maxLevel = 0,
    timerColor = '',
    messages = {},
    levels = {},
    mapHighlightProps = {},
    cardStatus = 0,  // 0: transition  1: maze  2: lose
    mazeTarget = null,
    mazeMapTarget = null,
    levelInfo = null,
    timerInfo = null,
    cardInfo = null,
    transition = {},
    currentLevel = 1;
    
function init() {

    console.log('Starting to init...');
    
    propertiesDeffered = $.Deferred();
    
    // Get window size
    windowWidth = $(window).width();
    windowHeight = $(window).height();
    
    console.log('Screen size: ' + windowWidth + ' x ' + windowHeight);
    
    // Sets my body to fit in all screen!
    $('body').width(windowWidth).height(windowHeight);
    
    // Initilize fast click to prevent click delay
    Origami.fastclick(document.body);
    
    // Reference DOM elements to easy access
    mazeTarget = $('#maze');
    mazeMapTarget = $('#mazemap');
    levelInfo = $('#levelInfo');
    timerInfo = $('#timerInfo');
    cardInfo = $("#card");
    
    transition.title = $('#transition #title');
    transition.msg1 = $('#transition #msg1');
    transition.msg2 = $('#transition #msg2');
    transition.stars = $('#transition #stars');
    transition.play = $('#transition #play');
    transition.back = $('#transition #back');
    transition.stars = $('#transition #stars');
    
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
        
        // Reads user's current level from storage
        retrievePlayerCurrentLevel();
        
        // Load main menu
        configureMainMenuEvents();

        // Load transition screen
        configureTransitionEvents();

        // Update record massage based on level
        updateRecordMessage();
        
        // Hide splashscreen
        navigator.splashscreen.hide();
          
        // Set up flip to work manually
        cardInfo.flip({trigger: 'manual', speed: 700});
        
        // When flip is done - callback
        cardInfo.on('flip:done', flipDoneCallback);

        // Can't scroll mazes
        cardInfo.on('touchmove', function(e) { e.preventDefault(); }, false);      
    });
    
    console.log('Init method reached its end');
}

var MainMenu = {
};

var Transition = {
};

var Mazes = {
};

var Timer = {
};

function updateCurrentLevel(level) {
    
    console.log('Updating level {0} to {1}'.format
                (currentLevel, level ? level : currentLevel + 1));
    
    currentLevel = level ? level : currentLevel + 1;
    
    console.log('Saving level {0} to local storage...'.format(currentLevel));
    localStorage.setItem('level', currentLevel);
    
    // Update record message regarding new level
    updateRecordMessage();
}

function retrievePlayerCurrentLevel() {

    console.log('Retrieving level from local storage...');

    var level = localStorage.getItem('level');
        
    if(level === null || level.length === 0)
        level = 1;
        
    currentLevel = parseInt(level); 
    
    console.log('Retrieved level {0} from local storage.'.format(currentLevel));
}

function resetLevels() {

    console.log('Reseting game to level 1...');
        
    // Resets level 1, actually
    updateCurrentLevel(1);
    
    // Setup Transition to original state
    configureTransitionEvents();
    
    // Setup Menu to original state
    configureMainMenuEvents();
    
    updateRecordMessage();
}

function configureMainMenuEvents() {
    
    console.log('Loading main menu (adding listeners)...');
    
    var menu = $('#menu');
    
    menu.find('#options #play').off('click').on('click', function(event) {
        
        menu.fadeOut("slow", function() {
            
            updateTransitionText(STATUS.NEW);
            
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
    }).html(messages['menu.new']);
    
    // Paints record in white
    menu.find('#options #record').css('color', '#FFF');
    
    // Titles gets painted white
    menu.find('#title').css('color', '#FFF');
    
    // If menu's option is NEW GAME or CONTINUE
    if(currentLevel > 1)
        menu.find('#options #play').html(messages['menu.continue']);
    
    // If he's already won, different layout
    if(currentLevel > maxLevel)
        configureMainMenuWinner();
    
    console.log('Main Menu loaded!');
}

function configureMainMenuWinner() {

    console.log('Configuring main menu to winner mode...');
    
    var menu = $('#menu');
    
    // Record is painted yellow too
    $('#menu #options #record').css('color', 'yellow');
    
    // Titles gets painted yellow
    menu.find('#title').css('color', 'yellow');
    
    // Click on Reset button
    menu.find('#options #play').off('click').
    on('click', function(event) {  
        
        console.log('Clicking on reset button...');

        var reset = $('#reset');
        
        // Show dialog to confirm
        reset.show();
        
        // If clicks no, just close it
        reset.find('#no').on('click', function(event) {
            reset.hide();
        });
        
        // If accepts, resets and closes
        reset.find('#yes').on('click', function(event) {
            resetLevels();
            reset.hide();
        });
        
    }).html(messages['menu.reset']);
}

function updateRecordMessage() {
    
    var message = '';
    
    if(currentLevel > maxLevel)
        message = messages['menu.record.win'];  
    else
        message = messages['menu.record'].format(currentLevel);
        
    $('#menu #options #record').html(message);
}

function configureTransitionEvents() {
    
    console.log('Loading transition (adding listeners)...');
    
    // Shows Play button is case it was hidden
    transition.play.show();
    
    // Initial state, when flipped maze is expected
    cardStatus = 0;
    
    // Click on PLAY
    transition.play.on('click', function(event) {  
        console.log('Flipping card...');
        // Flips card to maze side
        cardInfo.flip('toggle');
    });
    
    // Click on back to MENU
    transition.back.on('click', function(event) {
        $('#mazes').fadeOut("slow", function() {
            
            if(currentLevel > 1 && currentLevel <= maxLevel)
                $('#menu #options #play').html(messages['menu.continue']);
            
            $('#menu').fadeIn("slow");
        });
    });
    
    console.log('Transition screen callbacks loaded!');
}

function flipDoneCallback () {
        
    switch (cardStatus) {
    
        // If it's flipping from transition to maze
        case 0:
            // Let's start game for real!
            startLevel();
            
            updateTransitionText(STATUS.NEXT, currentLevel+1);
        
            cardStatus = 1;
        break;
            
        // If its moving from maze to transition
        case 1:
            
            // Load next level
            loadLevel(currentLevel);
            
            cardStatus = 0;
        break;
            
        // If player lose
        case 2:
            
            // Load next level
            loadLevel(currentLevel);

            cardStatus = 0;
        break;
            
        // Player Wins!
        case 3:        
        break;
    }
}

function updateTransitionText(status, l) {
    
    console.log('Setting transition messages to {0}...'.format(status));
    
    var level = l == undefined ? currentLevel : l,
        messagePattern = 'transition.{0}.{1}',
        time = levels[level-1] ? levels[level-1].timer : 0;
    
    transition.title.html(
        messages[messagePattern.format(status, 'title')]
    );
    
    transition.msg1.html(
        messages[messagePattern.format(status, 'msg1')].format(level)
    );
    
    transition.msg2.html(
        messages[messagePattern.format(status, 'msg2')].format(time)
    );
    
    // TODO: STARS AND GAME OVER
    // Stars and Game Over message on transition
    transition.stars.find('#star1').hide();
    transition.stars.find('#star2').hide();
    transition.stars.find('#star3').hide();
    transition.stars.find('#gameover').hide();
    
    if(status == STATUS.NEXT) {     
        transition.stars.find('#star1').show();
        transition.stars.find('#star2').show();
        transition.stars.find('#star3').show();
    } else if(status == STATUS.LOSE) {
        transition.stars.find('#gameover').show();
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

function winLevel() {
    
    console.log('Victory level {0}'.format(currentLevel));
    
    // Prevent user of clicking many times
    removeMapClickEvents();
    
    // Cleans and resets timer
    resetTimer();
    
    // Advances level (no params adds 1)    
    updateCurrentLevel();
    
    // Win the game!
    if(currentLevel > maxLevel) {
        gameOver();
        return;
    }
    
    // Wait until flip
    setTimeout(function() {
        
        // Clear green painting
         $('#mazemap area').trigger('cleanAll');
        
        // Clear level number during transition
        levelInfo.hide();
        
        // Flips to next level (already preloaded)
        cardInfo.flip('toggle');
        
    }, 1000); 
} 

function gameOver() {

    console.log('Player win last level ({0})!'.format(currentLevel));
    
    // Paints screen in green
    cardInfo.css('background-color', 'rgba(0, 200, 0, 0.5)');
    
    // You Win message!
    updateTransitionText(STATUS.WIN);
    
    // You Win when flip ends!
    cardStatus = 3;
    
    // No more levels to play
    transition.play.hide();
    
    // Menu is now different
    configureMainMenuWinner();

    // Wait until flip
    setTimeout(function() {
        
        // Clear green painting
         $('#mazemap area').trigger('cleanAll');
        
        // Clear level number during transition
        levelInfo.hide();
        
        // Remove green color effect
        cardInfo.css('background-color', 'rgba(255, 255, 255, 0)');
        
        // Flips to next level (already preloaded)
        cardInfo.flip('toggle');
        
    }, 3000); 
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
    
    // You lose when flip ends!
    cardStatus = 2;
    
    // You lose message prepared
    updateTransitionText(STATUS.LOSE);
    
    // Goes to back to level 1
    resetLevels();
    
    // Wait until flip
    setTimeout(function() {
        
        // Clear level number during transition
        levelInfo.hide();
        
        // Flips to next level (already preloaded)
        cardInfo.flip('toggle');
        
        // Paints screen in white again
        cardInfo.css('background-color', 'rgba(0, 0, 0, 0)');
        
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
}

function addMapClickEvents() {
        
    console.log('Binding maze click events...');

    // Click on correct position: win
    $('#mazemap area').bind('click', function (event) {
        winLevel();
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
