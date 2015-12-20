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
    levelColors = [],
    adOptions = {},
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
    
    // Load properties
    $.getJSON('conf/properties.json').done(function (json) {
        
        console.log('Properties loaded: {0}'.format(JSON.stringify(json)));
        
        messages = json['messages'];
        levels = json['levels'];
        
        maxLevel = json['maxLevel'];
        mapHighlightProps = json['mapHighlightProps'];
        levelColors = json['levelColors'];
        imageFilesPath = json['imageFilesPath'];
        Timer.color = json['timerColor'];
        
        adOptions = json['adOptions'];
        
        widthScale = json['imageWidth'] / windowWidth;
        heightScale = json['imageHeight'] / windowHeight;
        
        propertiesDeffered.resolve();
        
    }).fail(function(e) {
        alert('Severe internal error: ' + e.status);
    });

    // When properties are all loaded
    $.when(propertiesDeffered).done(function() {
        
        console.log('Starting properties loaded callback...');
    
        // Init menu module (needed to retrieve level)
        Menu.init();
        
        // Reads user's current level from storage
        retrievePlayerLevel();
        
        Menu.configure();
        
        // Init transition module
        Transition.init();
        
        // Init maze module
        Maze.init();
        
        // Init card module
        Card.init();
        
        // Init timer module
        Timer.init();
        
        // When pressing BACK button
        document.addEventListener("backbutton", onBackButtonPress, false);
        
        // Hide splashscreen after 1s
        setTimeout(function() {
            navigator.splashscreen.hide();
        }, 1000);
        
        // Init ads module
        Ads.init();  
      });
    
    console.log('Init method reached its end');
}

// ***** Modules *****

var Menu = {
    
    dom: null,
    
    init: function() {
        
        this.dom = {
            self: $('#menu'),
            title: $('#menu #title'),
            play: $('#menu #options #play'),
            instructions: $('#menu #options #instructions'),
            status: $('#menu #options #status'),
            credits: $('#menu #options #credits')
        };
    },
    
    configure: function() {
    
        console.log('Loading original main menu...');
        
        // Titles gets painted white
        this.dom.title.css('color', '#000');
        
        // Play button
        this.dom.play.off('click').on('click', function(event) {
        
            Menu.dom.self.fadeOut("fast", function() {
            
                if(level > 1)
                    Transition.updateText(STATUS.RESUME);
                else
                    Transition.updateText(STATUS.NEW);
            
                // Change cards
                Maze.dom.self.fadeIn("fast");
            
                // Load "first" level
                Maze.loadLevel();
            
                // Resets timer - ready to play!
                Timer.resetTimer(); 
            
                // Position correctly level indicator
                Maze.dom.levelInfo.html(level);
                Maze.dom.levelInfo.css('top', 
                                (windowHeight/2 - Maze.dom.levelInfo.height()/2) + 'px');
            });

        }).html(messages['menu.new']);
    
        // Paints status in white
        this.dom.status.css('color', '#000');

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
        this.dom.title.css('color', '#FF0');
        
        // Status is painted yellow too
        this.dom.status.css('color', '#FF0');

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
    
    init: function() {
    
        this.dom = {
            self: $('#game #transition'),
            title: $('#game #transition #title'),
            msg1: $('#game #transition #msg1'),
            msg2: $('#game #transition #msg2'),
            play: $('#game #transition #play'),
            playWrapper: $('#game #transition #playWrapper'),
            back: $('#game #transition #back'),
            stars: $('#game #transition #stars'),
            special: $('#game #transition #specialMsg'),
            specialWrapper: $('#game #transition #specialMsgWrapper'),
            trophy: $('#game #transition #trophyWrapper')
        };
        
        this.configure();
    },
    
    configure: function() {
    
        console.log('Loading transition...');

        // Shows Play button is case it was hidden
        this.dom.playWrapper.show();
        
        // Resets transition card status
        Card.status = STATUS.NEW;

        // Click on PLAY
        this.dom.play.off('click').on('click', function(event) { 
            // Flips card to maze side
            Card.flip();
        });

        // Click on back to MENU
        this.dom.back.off('click').on('click', function(event) {
            onBackButtonPress();
        });

        console.log('Transition screen callbacks loaded!');
    },
    
    updateText: function(status, l) {
    
        console.log('Setting transition messages to {0}...'.format(status));

        var newLevel = l == undefined ? level : l,
            messagePattern = 'transition.{0}.{1}',
            time = levels[newLevel-1] ? levels[newLevel-1].timer : 0,
            bg = '#FFF';

        this.dom.title.html(
            messages[messagePattern.format(status, 'title')]
        );

        this.dom.msg1.html(
            messages[messagePattern.format(status, 'msg1')].format(newLevel)
        );

        this.dom.msg2.html(
            messages[messagePattern.format(status, 'msg2')].format(time)
        );
        
        this.dom.play.html(
            messages[messagePattern.format(status, 'play')]
        );
        
        // Background color is based on level
        bg = this.calculateBgColor(newLevel);

        // Stars, special message
        this.dom.stars.hide();
        this.dom.stars.find('#star1').hide();
        this.dom.stars.find('#star2').hide();
        this.dom.stars.find('#star3').hide();
        this.dom.trophy.hide();
        this.dom.specialWrapper.hide();
        
        switch (status) {
        
            case STATUS.NEXT:
                
                var timePassedLevel = levels[newLevel-2].timer;
                
                console.log('Level {0} had {1}s to complete and took {2}s'.
                            format(newLevel-1, timePassedLevel, Timer.secondsPassed));
                
                // If finished in less or equal 20% of time
                if(Timer.secondsPassed <= timePassedLevel*0.2)
                    this.dom.stars.find('#star1').show();
                
                // If finished in less or equal 60% of time
                if(Timer.secondsPassed <= timePassedLevel*0.6)
                    this.dom.stars.find('#star2').show();

                this.dom.stars.find('#star3').show();
                this.dom.stars.show();
        
            break;
                
            case STATUS.LOSE:
                this.dom.special.html(messages[messagePattern.format(status, 'special')]);
                this.dom.specialWrapper.show();
                bg = messages[messagePattern.format(status, 'bg')];
            break;
            
            case STATUS.RESUME:
            case STATUS.NEW:
                this.dom.special.html(messages[messagePattern.format(status, 'special')]);
                this.dom.specialWrapper.show();
            break;
                
            case STATUS.WIN:
                this.dom.trophy.show();
                this.dom.playWrapper.hide();
                bg = messages[messagePattern.format(status, 'bg')];
            break;
        }
        
        // Realy paints background
        Maze.dom.self.css('background-color', bg);
    },
    
    calculateBgColor: function(specificLevel) {
        
        console.log('Calculating next level color...');
        
        specificLevel = specificLevel == undefined ? level : specificLevel;
        
        var base = levelColors[Math.floor(specificLevel/10)],
            relativeOffset = (specificLevel%10) * base.offset,
            opacity = 0.8;
        
        // Copy that color options
        base = $.extend({}, base);
        
        console.log('Base color {0} and offset {1}'.
                    format(Math.floor(specificLevel/10), relativeOffset));
        
        switch(Math.floor(specificLevel/10)) {
        
            case 0: 
                base.g += relativeOffset;
            break;
                
            case 1: 
                base.r -= relativeOffset;
            break;
                
            case 2: 
                base.g -= relativeOffset;
                base.b += relativeOffset;
            break;
                
            case 3: 
                base.r += relativeOffset;
            break;
                
            case 4: 
                base.g += relativeOffset;
            break;
        }
        
        // Fix outbounds
        base.r = base.r > 255 ? 255 : base.r;
        base.g = base.g > 255 ? 255 : base.g;
        base.b = base.b > 255 ? 255 : base.b;
        
        base.r = base.r < 0 ? 0 : base.r;
        base.g = base.g < 0 ? 0 : base.g;
        base.b = base.b < 0 ? 0 : base.b;
        
        var resultColor = 'rgba({0}, {1}, {2}, {3})'.format(base.r, base.g, base.b, opacity);
        
        console.log('Color result: ' + resultColor);
        return resultColor;
    }
};

var Maze = {
    
    dom: null,
    
    init: function() {
        
        // Link to DOM nodes
        this.dom = {
            self: $('#game'),
            target: $('#game #mazes #maze'),
            mapTarget: $('#game #mazes #mazemap'),
            levelInfo: $('#game #levelInfo')
        };
    },
    
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
        
        // Load next level transition screen
        Transition.updateText(STATUS.NEXT);

        // Wait until flip
        setTimeout(function() {

            // Clear green painting
            Maze.dom.mapTarget.find('area').trigger('cleanAll');

            // Clear level number during transition
            Maze.dom.levelInfo.hide();

            // Flips to next level (already preloaded)
            Card.flip();

        }, 1000); 
    },
    
    loseLevel: function() { 
    
        console.log('Lose level {0}'.format(level));

        // Remove solution from maze
        this.dom.mapTarget.find('area').remove();

        // Prevent user of clicking many times
        this.removeMazeEvents();

        // Cleans and resets timer
        Timer.resetTimer();
        
        // Goes to back to level 1
        resetGame();

        // You lose message prepared
        Transition.updateText(STATUS.LOSE);

        // You lose when flip ends!
        Card.status = STATUS.LOSE;

        // Wait until flip
        setTimeout(function() {

            // Clear level number during transition
            Maze.dom.levelInfo.hide();

            // Flips to next level (already preloaded)
            Card.flip();

        }, 1700); 
    },
    
    gameOver: function() {

        console.log('Player win last level ({0})!'.format(level));

        // You Win message!
        Transition.updateText(STATUS.WIN);

        // You Win when flip ends!
        Card.status = STATUS.WIN;

        // Menu is now different
        Menu.configureWinner();

        // Wait until flip
        setTimeout(function() {

            // Clear green painting
            Maze.dom.mapTarget.find('area').trigger('cleanAll');

            // Clear level number during transition
            Maze.dom.levelInfo.hide();

            // Flips to next level (already preloaded)
            Card.dom.flip('toggle');

        }, 2000); 
    },
    
    addMazeEvents: function() {
        
        console.log('Binding maze click events...');

        // Click on correct position: win
        Maze.dom.mapTarget.find('area').bind('click', function (event) {
            Maze.winLevel();
        }); 

        // Click anywhere else: lose
        Card.dom.bind('click', function(event) { 
            if(event.target.nodeName != 'AREA')
                Maze.loseLevel();
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
    status: null,
    
    init: function() {
        
        this.dom = $("#card");
        this.status = STATUS.NEW;
        
        this.configure();
    },
    
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
                
                // No ad during maze
                Ads.hideBanner();

                // Let's start game for real!
                Maze.startLevel();

                Card.status = STATUS.NEXT;
            break;

            // If its moving from maze to transition
            case STATUS.NEXT:
                
                // Load next level
                Maze.loadLevel();
                
                // Change bg color from RED to level 1 color
                Maze.dom.self.css('background-color', Transition.calculateBgColor());
                
                // Transition gets an ad!
                Ads.showBanner();

                Card.status = STATUS.NEW;   
            break;
                
            case STATUS.LOSE:
                
                // Show BIG ad
                Ads.showInterstitial();

                // Load next level
                Maze.loadLevel();
                
                // Change bg color from RED to level 1 color
                Maze.dom.self.css('background-color', Transition.calculateBgColor());

                Card.status = STATUS.NEW;
            break;

            case STATUS.WIN: 
                // Show BIG ad
                Ads.showInterstitial();   
            break;
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
    secondsPassed: 0,
    secondsIntervalRef: null,
    
    init: function() {
        this.dom = $('#timerInfo');
        this.secondsPassed = 0;
    },
    
    startTimer: function() {

        var seconds = levels[level-1].timer;
            
        console.log('Starting timer for {0} seconds...'.format(seconds));

        // Set new time for that level
        this.dom.css('transition-duration', seconds + 's');

        // Set original transition property (top position)
        this.dom.css('transition-property', 'top');

        // This starts the animation, bringing the div down to 0
        this.dom.css('top', 0);
        
        // Calculate seconds taken to finsish level
        this.secondsPassed = 0;
        this.secondsIntervalRef = setInterval(function() {
            Timer.secondsPassed++;
        }, 1000);

        // Callback when animation ends
        this.dom.one('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd',
            function() {
                console.log('Timer animation ended: {0} seconds passed'.format(seconds));

                Timer.dom.css('background-color', 'red');
                Maze.loseLevel();
            });    
    },
    
    resetTimer: function() {
    
        console.log('Reseting timer...');
        
        // Stops counting time taken to finish maze
        clearInterval(this.secondsIntervalRef);

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

var Ads = {
    
    bannerVisible: false,

    init: function() {
        
        if(window.AdMob) {
            
            AdMob.setOptions(adOptions);
 
            AdMob.prepareInterstitial();
            this.showBanner();
        }
    },
    
    showBanner: function() {
        if(window.AdMob && !this.bannerVisible) {
           AdMob.createBanner({
                adId : adOptions.bannerId,
                position : AdMob.AD_POSITION.BOTTOM_CENTER,
                autoShow : true,
               overlap: true
            });
            
            this.bannerVisible = true;
        }
    },
    
    hideBanner: function() {
        if(window.AdMob && this.bannerVisible) {
            AdMob.removeBanner();
            this.bannerVisible = false;
        }
    },
    
    showInterstitial: function() {
        if(window.AdMob)
            AdMob.showInterstitial();
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
function onBackButtonPress() {
    
    console.log('Pressed back button');
    
    if(Card.status == STATUS.NEXT || Card.status == STATUS.LOSE)
        return;
    
    if (Maze.dom.self.is(':visible')) {
        Maze.dom.self.fadeOut("fast", function() {

            // Check if change New game to Continue
            if(level > 1 && level <= maxLevel)
                Menu.dom.play.html(messages['menu.continue']);

            Menu.dom.self.fadeIn("fast");
            
            // Show banner again (it's hidden from transition screen)
            Ads.showBanner();
        });
    } else 
        navigator.app.exitApp(); 
}