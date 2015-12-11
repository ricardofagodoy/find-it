/*** Find It! - Ricardo Godoy (November 2015) ***/

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

var propertiesDeffered = $.Deferred(),
    windowWidth = 0,
    windowHeight = 0,
    imageFilesPath = '',
    widthScale = 0,
    heightScale = 0,
    maxLevel = 0,
    messages = {},
    levels = {},
    mapHighlightProps = {},
    level = 1;
    
function init() {

    console.log('Starting to init...');
        
    // Get window size
    windowWidth = $(window).width();
    windowHeight = $(window).height();
    
    console.log('Screen size: ' + windowWidth + ' x ' + windowHeight);
    
    // Sets my body to fit in all screen!
    $('body').width(windowWidth).height(windowHeight);
    
    // Initilize fast click to prevent click delay
    Origami.fastclick(document.body);
    
    // Initialize link to DOM elements
    Menu.dom = {
        self: $('#menu'),
        title: $('#menu #title'),
        play: $('#menu #options #play'),
        instructions: $('#menu #options #instructions'),
        status: $('#menu #options #status'),
        credits: $('#menu #options #credits')
    };
    
    Transition.dom = {
        self: $('#game'),
        title: $('#game #transition #title'),
        msg1: $('#game #transition #msg1'),
        msg2: $('#game #transition #msg2'),
        play: $('#game #transition #play'),
        back: $('#game #transition #back'),
        stars: $('#game #transition #stars'),
    };
    
    Mazes.dom = {
        self: $('#game'),
        target: $('#game #mazes #maze'),
        mapTarget: $('#game #mazes #mazemap'),
        levelInfo: $('#game #levelInfo')
    };
    
    Card.dom = $("#card");
    Timer.dom = $('#timerInfo');
    
    // Load properties
    $.getJSON('conf/properties.json').done(function (json) {
        
        console.log('Properties loaded: {0}'.format(JSON.stringify(json)));
        
        messages = json['messages'];
        levels = json['levels'];
        
        maxLevel = json['maxLevel'];
        mapHighlightProps = json['mapHighlightProps'];
        imageFilesPath = json['imageFilesPath'];
        Timer.color = json['timerColor'];
        
        widthScale = json['imageWidth'] / windowWidth;
        heightScale = json['imageHeight'] / windowHeight;
        
        propertiesDeffered.resolve();
        
    }).fail(function(e) {
        alert('Severe internal error: ' + e.status);
    });

    // When properties are all loaded
    $.when(propertiesDeffered).done(function() {
        
        console.log('Starting properties loaded callback...');
        
        // Reads user's current level from storage
        retrievePlayerLevel();
        
        // Load main menu
        Menu.configure();

        // Load transition screen
        Transition.configure();
        
        // Configure some card properties
        Card.configure();
        
        // Hide splashscreen
        setTimeout(function() {
            navigator.splashscreen.hide();
        }, 1000);
    });
    
    console.log('Init method reached its end');
}

// ***** Modules *****

var Menu = {
    
    dom: null,
    
    configure: function() {
    
        console.log('Loading original main menu...');
        
        // Titles gets painted white
       this.dom.title.css('color', '#FFF');
    
        // Play button
        this.dom.play.off('click').on('click', function(event) {
        
            Menu.dom.self.fadeOut("fast", function() {
            
                if(level > 1)
                    Transition.updateText(STATUS.RESUME);
                else
                    Transition.updateText(STATUS.NEW);
            
                // Slowly cards
                Mazes.dom.self.fadeIn("fast");
            
                // Load "first" level
                Mazes.loadLevel();
            
                // Resets timer - ready to play!
                Timer.resetTimer(); 
            
                // Position correctly level indicator
                Mazes.dom.levelInfo.html(level);
                Mazes.dom.levelInfo.css('top', 
                                (windowHeight/2 - Mazes.dom.levelInfo.height()/2) + 'px');
            });

        }).html(messages['menu.new']);
    
        // Paints status in white
        this.dom.status.css('color', '#FFF');

        // If menu's option is NEW GAME or CONTINUE
        if(level > 1)
            this.dom.play.html(messages['menu.continue']);
    
        // If he's already won, different layout
        if(level > maxLevel)
            this.configureWinner();
    
        console.log('Main Menu loaded!');
    },
    
    configureWinner: function() {
    
        console.log('Configuring main menu to winner mode...');

        // Titles gets painted yellow
        this.dom.title.css('color', 'yellow');
        
        // Status is painted yellow too
        this.dom.status.css('color', 'yellow');

        // TODO: FIX THIS SHIT
        var resetConfirmation = $('#reset');

        // If clicks no, just close it
        resetConfirmation.find('#no').off('click').on('click', function(event) {
            resetConfirmation.hide();
        });

        // If accepts, resets and closes
        resetConfirmation.find('#yes').off('click').on('click', function(event) {
            resetGame();
            resetConfirmation.hide();
        });
        
        // Click on Reset button
        this.dom.play.off('click').on('click', function(event) {  

            console.log('Clicking on reset button...');

            // Show dialog to confirm
            resetConfirmation.show();

        }).html(messages['menu.reset']);
    },
    
    updateStatusMessage: function() {
    
        var message = '';

        if(level > maxLevel)
            message = messages['menu.status.win'];  
        else
            message = messages['menu.status'].format(level);

        this.dom.status.html(message);
    } 
};

var Transition = {
    
    dom: null,
    
    configure: function() {
    
        console.log('Loading transition...');

        // Shows Play button is case it was hidden
        this.dom.play.show();
        
        // Resets transition card status
        Card.status = STATUS.NEW;

        // Click on PLAY
        this.dom.play.off('click').on('click', function(event) { 
            // Flips card to maze side
            Card.flip();
        });

        // Click on back to MENU
        this.dom.back.off('click').on('click', function(event) {
            
            Mazes.dom.self.fadeOut("fast", function() {

                // Check if change New game to Continue
                if(level > 1 && level <= maxLevel)
                    Menu.dom.play.html(messages['menu.continue']);

                Menu.dom.self.fadeIn("fast");
            });
        });

        console.log('Transition screen callbacks loaded!');
    },
    
    updateText: function(status, l) {
    
        console.log('Setting transition messages to {0}...'.format(status));

        var newLevel = l == undefined ? level : l,
            messagePattern = 'transition.{0}.{1}',
            time = levels[level-1] ? levels[level-1].timer : 0;

        this.dom.title.html(
            messages[messagePattern.format(status, 'title')]
        );

        this.dom.msg1.html(
            messages[messagePattern.format(status, 'msg1')].format(level)
        );

        this.dom.msg2.html(
            messages[messagePattern.format(status, 'msg2')].format(time)
        );

        // TODO: STARS AND GAME OVER
        // Stars and Game Over message on transition
        this.dom.stars.find('#star1').hide();
        this.dom.stars.find('#star2').hide();
        this.dom.stars.find('#star3').hide();
        this.dom.stars.find('#gameover').hide();
        this.dom.stars.find('#ready').hide()
         this.dom.stars.find('#trophy').hide();

        switch (status) {
        
            case STATUS.NEXT:
                this.dom.stars.find('#star1').show();
                this.dom.stars.find('#star2').show();
                this.dom.stars.find('#star3').show();
            break;
                
            case STATUS.LOSE:
                this.dom.stars.find('#gameover').show();
            break;
            
            case STATUS.RESUME:
            case STATUS.NEW:
                this.dom.stars.find('#ready').show();
            break;
                
            case STATUS.WIN:
                this.dom.stars.find('#trophy').show();
            break;
        }
    }
};

var Mazes = {
    dom: null,
    
    loadLevel: function() {
    
        console.log('Starting to load level {0}...'.format(level));
    
        var levelProps = levels[level-1];
    
        // If level does not exist (error)
        if(levelProps == undefined) {
            console.log('Invalid level: {0}'.format(level));
            return;
        }
    
        console.log('About to load {0}...'.format(imageFilesPath.format(level)));
    
        // Load image from file
        this.dom.target.attr('src', imageFilesPath.format(level));

        // Fits image to use all screen size
        this.dom.target.width(windowWidth).height(windowHeight);
    
        // Remove previous area
        this.dom.mapTarget.find('area').remove();
    
        // Position to correct click
        var area = $('<area>', {
            shape: 'poly',
            coords: levelProps.coords.map(function(value, index) {
                return Math.floor(index%2 ? value/heightScale : value/widthScale);
            }).join(', ')
        }).appendTo(this.dom.mapTarget);
    
        // Initialize jquery maphilight to current maze
        this.dom.target.maphilight(mapHighlightProps);
    
        console.log('Level {0} loaded with success!'.format(level));
    },
    
    startLevel: function() {
      
        console.log('Starting level {0}...'.format(level));

        // Update and show level information
        this.dom.levelInfo.html(level);
        this.dom.levelInfo.show();

        // Add click events
        this.addMazeEvents();

        // Start timer for current level
        Timer.startTimer();
    },
    
    winLevel: function() {
    
        console.log('Victory level {0}'.format(level));

        // Prevent user of clicking many times
        this.removeMazeEvents();

        // Cleans and resets timer
        Timer.resetTimer();

        // Advances level (no params adds 1)    
        updateLevel();

        // Win the game!
        if(level > maxLevel) {
            this.gameOver();
            return;
        }

        // Wait until flip
        setTimeout(function() {

            // Clear green painting
            Mazes.dom.mapTarget.find('area').trigger('cleanAll');

            // Clear level number during transition
            Mazes.dom.levelInfo.hide();

            // Flips to next level (already preloaded)
            Card.flip();

        }, 1000); 
    },
    
    loseLevel: function() { 
    
        console.log('Lose level {0}'.format(level));

        // Paints screen in red
        Card.dom.css('background-color', 'rgba(255, 0, 0, 0.5)');

        // Remove solution from maze
        this.dom.mapTarget.find('area').remove();

        // Prevent user of clicking many times
        this.removeMazeEvents();

        // Cleans and resets timer
        Timer.resetTimer();

        // You lose message prepared
        Transition.updateText(STATUS.LOSE);

        // Goes to back to level 1
        resetGame();
        
        // You lose when flip ends!
        Card.status = STATUS.LOSE;

        // Wait until flip
        setTimeout(function() {

            // Clear level number during transition
            Mazes.dom.levelInfo.hide();

            // Flips to next level (already preloaded)
            Card.flip();

            // Paints screen in white again
            Card.dom.css('background-color', 'rgba(0, 0, 0, 0)');

        }, 2000); 
    },
    
    gameOver: function() {

        console.log('Player win last level ({0})!'.format(level));

        // Paints screen in green
        Card.dom.css('background-color', 'rgba(0, 200, 0, 0.5)');

        // You Win message!
        Transition.updateText(STATUS.WIN);

        // You Win when flip ends!
        Card.status = STATUS.WIN;

        // No more levels to play
        Transition.dom.play.hide();

        // Menu is now different
        Menu.configureWinner();

        // Wait until flip
        setTimeout(function() {

            // Clear green painting
            Mazes.dom.mapTarget.find('area').trigger('cleanAll');

            // Clear level number during transition
            Mazes.dom.levelInfo.hide();

            // Remove green color effect
            Card.dom.css('background-color', 'rgba(255, 255, 255, 0)');

            // Flips to next level (already preloaded)
            Card.dom.flip('toggle');

        }, 2000); 
    },
    
    addMazeEvents: function() {
        
        console.log('Binding maze click events...');

        // Click on correct position: win
        Mazes.dom.mapTarget.find('area').bind('click', function (event) {
            Mazes.winLevel();
        }); 

        // Click anywhere else: lose
        Card.dom.bind('click', function(event) { 
            if(event.target.nodeName != 'AREA')
                Mazes.loseLevel();
        });   
    },
        
    removeMazeEvents: function() {
    
        console.log('Unbinding maze click events...');

        this.dom.mapTarget.find('area').unbind('click');
        Card.dom.unbind('click');
    }
};

var Card = {

    dom: null,
    status: STATUS.NEW,
    
    configure: function() {
    
        // Set up flip to work manually
        this.dom.flip({trigger: 'manual', speed: 700});
        
        // When flip is done - callback
        this.dom.on('flip:done', this.flipDoneCallback);

        // Can't scroll mazes
        this.dom.on('touchmove', function(e) { e.preventDefault(); }, false);      
    },
    
    flipDoneCallback: function() {
        
        console.log('Card finished flipping status: {0}'.format(Card.status));
        
        switch (Card.status) {

            // If it's flipping from transition to maze
            case STATUS.NEW:

                // Let's start game for real!
                Mazes.startLevel();

                Transition.updateText(STATUS.NEXT, level+1);

                Card.status = STATUS.NEXT;
            break;

            // If its moving from maze to transition
            case STATUS.NEXT:
            case STATUS.LOSE:

                // Load next level
                Mazes.loadLevel();

                Card.status = STATUS.NEW;
            break;

           // case STATUS.WIN:        break;
        }
    },
    
    flip: function() {  
        console.log('Flipping card...');
        this.dom.flip('toggle');
    } 
};

var Timer = {
    
    dom: null,
    color: 'null',
    
    startTimer: function() {

        var seconds = levels[level-1].timer;
            
        console.log('Starting timer for {0} seconds...'.format(seconds));

        // Set new time for that level
        this.dom.css('transition-duration', seconds + 's');

        // Set original transition property (top position)
        this.dom.css('transition-property', 'top');

        // This starts the animation, bringing the div down to 0
        this.dom.css('top', 0);

        // Callback when animation ends
        this.dom.one('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd',
            function() {
                console.log('Timer animation ended: {0} seconds passed'.format(seconds));

                Timer.dom.css('background-color', 'red');
                Mazes.loseLevel();
            });    
    },
    
    resetTimer: function() {
    
        console.log('Reseting timer...');

        // Prevents timer to animate when reseting
        this.dom.css('transition-property', 'none');

        // Pull back up the div
        this.dom.css('top', -windowHeight + 'px');

        // Set background to original colors
        this.dom.css('background-color', this.color);

        // Turn off callback when animation is completed (not needed when reseting)
        this.dom.off('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd');
    }
};

// ****** Some util functions ******

function updateLevel(newLevel) {
    
    console.log('Updating level {0} to {1}'.format
                (level, newLevel ? newLevel : level+1));
    
    level = newLevel ? newLevel : level + 1;
    
    console.log('Saving level {0} to local storage...'.format(level));
    
    localStorage.setItem('level', level);
    
    // Update status message regarding new level
    Menu.updateStatusMessage();
}
function retrievePlayerLevel() {

    console.log('Retrieving level from local storage...');

    var storedLevel = localStorage.getItem('level');
        
    if(storedLevel === null || storedLevel.length === 0)
        storedLevel = 1;
        
    updateLevel(parseInt(storedLevel)); 
    
    console.log('Retrieved level {0} from local storage.'.format(level));
}
function resetGame() {

    console.log('Reseting game to level 1...');
        
    // Resets level 1, actually
    updateLevel(1);
    
    // Setup Menu to original state
    Menu.configure();
    
    // Setup Transition to original state
    Transition.configure();
}