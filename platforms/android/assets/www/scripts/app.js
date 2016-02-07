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
    properties = undefined,
    messages = null,
    preloadedImagesList = [],
    levels = {},
    level = 1,
    levelIndex = 1; // Under each level, there are maxLevelIndex different mazes
    
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
        
        properties = json;
        
        messages = json['messages'];
        levels = json['levels'];
        
        Timer.color = json['timerColor'];
        
        properties['widthScale'] = json['imageWidth'] / windowWidth;
        properties['heightScale'] = json['imageHeight'] / windowHeight;
        
        propertiesDeffered.resolve();
        
    }).fail(function(e) {
        alert('Severe internal error: ' + e.status);
    });

    // When properties are all loaded
    $.when(propertiesDeffered).done(function() {
        
        console.log('Starting properties loaded callback...');
    
        // Reads user's current level from storage
        Persistence.retrievePlayerLevel();
        
        // Init menu module
        Menu.init();
        
        // Init sounds modules
        Sound.init();
        
        // Hide splashscreen
        setTimeout(function() {
            if(navigator.splashscreen)
                navigator.splashscreen.hide();
        }, 1000);
        
        // Init ads module
        Ads.init();
        
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
        
        // When process goes to background, stop sound!
        document.addEventListener("pause", function() {
          //  Sound.toggleMute();
        }, false);
        
        // When somes to foreground again
        document.addEventListener("resume", function() {
           // Sound.toggleMute();
        }, false); 
        
        // Preload images
        preloadImages([
            properties.instructionsImages[0], 
            properties.instructionsImages[1],
            'images/trophy.png',
            'images/star.gif'
        ]);
        
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
            credits: $('#menu #options #credits'),
            creditsScreen: $('#creditsScreen'),
            creditsScreenBack: $('#creditsScreen #thanks'),
            instructionScreen: $('#instructionScreen'),
            mute: $('#menu #mute')
        };
        
        // If he's already won, different layout
        if(level > properties.maxLevel)
            this.configureWinner();
        else
            this.configureOriginal();
        
        // If menu's option is NEW GAME or CONTINUE
        if(level > 1 && level <= properties.maxLevel)
            this.dom.play.html(messages['menu.continue']);
        
        // Click on credits
        this.dom.credits.off('click').on('click', function(event) {
            Sound.play('click');
            Menu.dom.creditsScreen.show();
        });
        
        this.dom.creditsScreenBack.off('click').on('click', function(event) {
            onBackButtonPress();
        });
        
        // Instructions
        this.dom.instructions.off('click').on('click', function(event) {
            Sound.play('click');
            Menu.showInstructions();
        });  
        
        // Drags mute buttons a little bit down if iOS 
        if(/(ipod|iphone|ipad)/i.test(navigator.userAgent))
            this.dom.mute.css('top', '4%');
        
        this.dom.mute.off('click').on('click', function(event) {
            
            Sound.toggleMute();
            
            if(Sound.isMuted())
                Menu.dom.mute.css('background-image', 'url("images/muted.png")');
            else
                Menu.dom.mute.css('background-image', 'url("images/sound.png")');
     
        });
    },
    
    configureOriginal: function() {
        
        console.log('Loading original main menu...');
        
        this.dom.title.css('color', '#76DB6D');
        
        // Play button
        this.dom.play.off('click').on('click', function(event) {
            
            // Change cards
            //Menu.dom.self.fadeOut('fast', function() {
                
                Menu.dom.self.hide();
            
                if(level > 1)
                    Transition.updateText(STATUS.RESUME);
                else
                    Transition.updateText(STATUS.NEW);
                
                Maze.dom.self.fadeIn("fast");
                
                // Load "first" level
                Maze.loadLevel();

                // Resets timer - ready to play!
                Timer.resetTimer(); 

                // Position correctly level indicator
                Maze.dom.levelInfo.html(level);
                Maze.dom.levelInfo.css('top', 
                                (windowHeight/2 - Maze.dom.levelInfo.height()/2) + 'px');
                
          //  });
            
            Sound.play('click');
             
        }).html(messages['menu.new']);
        
        // Paints status in black
        this.dom.status.css('color', '#76DB6D');
        
        // Update status message accoring to current level
        this.updateStatusMessage();
        
        console.log('Main Menu loaded!');
    },
    
    configureWinner: function() {
    
        console.log('Configuring main menu to winner mode...');

        // TODO: Titles gets painted yellow
        this.dom.title.css({color: '#E0BB00', 'text-shadow': '2px 2px 2px #000'});
        
        // Status is painted yellow too
        this.dom.status.css('color', '#E0BB00');

        // TODO: FIX THIS SHIT
        var resetConfirmation = $('#reset');

        // If clicks no, just close it
        resetConfirmation.find('#no').off('click').on('click', function(event) {
            Sound.play('click');
            resetConfirmation.hide();
        });

        // If accepts, resets and closes
        resetConfirmation.find('#yes').off('click').on('click', function(event) {
            Maze.resetGame();
            resetConfirmation.hide();
            
            // Flashes screen
            Menu.dom.self.fadeOut('fast', function() {
                Menu.dom.self.show();
            });
            
            // Original bg menu music, since you're at menu
            Sound.loadMenuSound();
        });
        
        // Win them all
        this.updateStatusMessage();
        
        // Click on Reset button
        this.dom.play.off('click').on('click', function(event) {  

            console.log('Clicking on reset button...');
            
            Sound.play('click');

            // Show dialog to confirm
            resetConfirmation.show();

        }).html(messages['menu.reset']);
    },
    
    updateStatusMessage: function() {
    
        var message = '';

        if(level > properties.maxLevel)
            message = messages['menu.status.win'].format(Persistence.retrieveStars());  
        else
            message = messages['menu.status'].format(level);

        this.dom.status.html(message);
    },
    
    showInstructions: function() {
        
        // Write first instruction message
        Menu.dom.instructionScreen.find('#textual').html(messages['instructions.default']);
        Menu.dom.instructionScreen.find('#pointer').hide();
        
        Menu.dom.instructionScreen.show();
                
        var correctX = properties['instructionsCorrectX'] / properties.widthScale,
            correctY = properties['instructionsCorrectY'] / properties.heightScale,
            numberClick = 0;
   
        // Clicks on screen to activate animation
        Menu.dom.instructionScreen.off('click').on('click', function(event) {
                
           switch (numberClick) {
                   
                case 0:
                   
                   // Block until animation ends
                   numberClick = 5;
                   
                   Menu.dom.instructionScreen.find('#pointer').fadeIn("fast");
                   
                    Menu.dom.instructionScreen.find('#pointer').animate({
                        left: correctX,
                        top: correctY
                    }, 1000, "linear", function() {

                        setTimeout(function() {
                            
                            Sound.play('correct');
                            
                            Menu.dom.instructionScreen.
                            css('background-image', 
                                'url("'+ properties.instructionsImages[1] +'")');
                            
                            Menu.dom.instructionScreen.find('#textual').
                                html(messages['instructions.done1']);
                            
                            setTimeout(function() {
                                Sound.play('menu');
                            }, 1500);
                            
                            numberClick = 1;
                            
                        }, 30);
                        
                    });
                break;
                   
                case 1:
                   Menu.dom.instructionScreen.find('#textual').
                        html(messages['instructions.done2']);
                break;
                   
                case 2:
                   Menu.dom.instructionScreen.find('#textual').
                        html(messages['instructions.done3']);
                break;
                   
                case 3:
                   onBackButtonPress();
                break;
            }
            
            numberClick++;
        });                          
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
                
                var timePassedLevel = levels[newLevel-2].timer,
                    stars = 1;
                
                console.log('Level {0} had {1}s to complete and took {2}s'.
                            format(newLevel-1, timePassedLevel, Timer.secondsPassed));
                
                // If finished in less or equal 20% of time
                if(Timer.secondsPassed <= timePassedLevel*0.2) {
                    this.dom.stars.find('#star1').show();
                    stars++;
                }
                
                // If finished in less or equal 60% of time
                if(Timer.secondsPassed <= timePassedLevel*0.6) {
                    this.dom.stars.find('#star2').show();
                    stars++;
                }

                this.dom.stars.find('#star3').show();
                this.dom.stars.show();
                
                Persistence.updateStars(stars);
        
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
                this.dom.playWrapper.hide();
                this.dom.trophy.show();
                bg = messages[messagePattern.format(status, 'bg')];
            break;
        }
        
        // Realy paints background
        Maze.dom.self.css('background-color', bg);
    },
    
    calculateBgColor: function(specificLevel) {
        
        console.log('Calculating next level color...');
        
        specificLevel = specificLevel == undefined ? level : specificLevel;
        
        var colorLevel = Math.floor(specificLevel/10),
            base = properties.levelColors[colorLevel],
            nextBase = properties.levelColors[colorLevel+1],
            levelOffset = (specificLevel%10),
            opacity = 0.8;
        
        if(specificLevel == properties['maxLevel'])
            base = properties['lastLevelColor'];
        else {
            if(!base['rOffset'])
                base['rOffset'] = Math.round((nextBase.r - base.r) / 10);
                base['rOffset'] = Math.round((nextBase.r - base.r) / 10);
            
            if(!base['gOffset'])
                base['gOffset'] = Math.round((nextBase.g - base.g) / 10);
            
            if(!base['bOffset'])
                base['bOffset'] = Math.round((nextBase.b - base.b) / 10);
        }
        
        // Copy that color options
        base = $.extend({}, base);
        
        console.log('Base color {0} and offset {1}'.format(colorLevel, levelOffset));
        
        base.r += base['rOffset'] * levelOffset;
        base.g += base['gOffset'] * levelOffset;
        base.b += base['bOffset'] * levelOffset;
        
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
    
        var levelProps = levels[level-1],  // Array stars on 0
            levelIndex = Persistence.retrieveLevelIndex(),
            fileName = properties.imageFilesPath.format(level, levelIndex);
    
        // If level does not exist (error)
        if(levelProps == undefined) {
            console.log('Invalid level: {0}'.format(level));
            return;
        }
    
        console.log('About to load {0}...'.format(fileName));
    
        // Load image from file
        this.dom.target.attr('src', fileName);

        // Fits image to use all screen size
        this.dom.target.width(windowWidth).height(windowHeight);
    
        // Remove previous area
        this.dom.mapTarget.find('area').remove();
        
        var widthScale = properties.widthScale,
            heightScale = properties.heightScale;
    
        // Position to correct click
        var area = $('<area>', {
            shape: 'poly',
            coords: levelProps.coords[levelIndex-1].map(function(value, index) {
                return Math.floor(index%2 ? value/heightScale : value/widthScale);
            }).join(', ')
        }).appendTo(this.dom.mapTarget);
    
        // Initialize jquery maphilight to current maze
        this.dom.target.maphilight(properties.mapHighlightProps);
    
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
        
        // User has already seen this level now, next time is different!
        Persistence.updateLevelIndex();
    },
    
    winLevel: function() {
    
        console.log('Victory level {0}'.format(level));

        // Prevent user of clicking many times
        this.removeMazeEvents();

        // Cleans and resets timer
        Timer.resetTimer();

        // Advances level (no params adds 1)    
        Persistence.updateLevel();
    
        // Win the game!
        if(level > properties.maxLevel) {
            this.gameOver();
            return;
        }
        
        // Found the shape sound!
        Sound.play('correct');
        
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

        }, 800); 
    },
    
    loseLevel: function() { 
    
        console.log('Lose level {0}'.format(level));

        // Remove solution from maze
        this.dom.mapTarget.find('area').remove();

        // Prevent user of clicking many times
        this.removeMazeEvents();

        // Cleans and resets timer
        Timer.resetTimer();
        
        // Lose sound
        Sound.play('lose');
        
        // Goes to back to level 1
        Maze.resetGame();

        // You lose message prepared
        Transition.updateText(STATUS.LOSE);

        // You lose when flip ends!
        Card.status = STATUS.LOSE;
        
        // Show BIG ad after 1s of losing
        setTimeout(function() {
            Ads.showInterstitial();
        }, 1000);
            
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

        // You Win when flip ends!
        Card.status = STATUS.WIN;

        Sound.play('win');
        
        // You Win message!
        Transition.updateText(STATUS.WIN);

        // Wait until flip
        setTimeout(function() {

            // Clear green painting
            Maze.dom.mapTarget.find('area').trigger('cleanAll');

            // Clear level number during transition
            Maze.dom.levelInfo.hide();

            // Flips to next level (already preloaded)
            Card.dom.flip('toggle');

        }, 4000); 
    },
    
    resetGame: function() {

        console.log('Reseting game to level 1...');

        // Resets level 1, actually
        Persistence.updateLevel(properties['startingLevel']);
        
        // Reset to 0 stars
        Persistence.updateStars(Persistence.retrieveStars()*-1);
    
        // Setup Menu to original state
        Menu.configureOriginal();

        // Setup Transition to original state
        Transition.configure();
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
        this.dom.flip({trigger: 'manual', speed: 500});
        
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
                
                // Plays level sound already!
                Sound.play('level');

                // Let's start game for real!
                Maze.startLevel();

                Card.status = STATUS.NEXT;
            break;

            // If its moving from maze to transition
            case STATUS.NEXT:
                
                // Load next level
                Maze.loadLevel();
                
                // Back to menu sound
                Sound.play('menu');
                
                // Change bg color from RED to level 1 color
                Maze.dom.self.css('background-color', Transition.calculateBgColor());
                
                // Transition gets an ad!
                Ads.showBanner();

                Card.status = STATUS.NEW;   
            break;
                
            case STATUS.LOSE:
                
                // Load next level
                Maze.loadLevel();
                
                Sound.play('menu');
                
                // Change bg color from RED to level 1 color
                Maze.dom.self.css('background-color', Transition.calculateBgColor());

                Card.status = STATUS.NEW;
            break;

            case STATUS.WIN: 
                // Show BIG ad
                Ads.showInterstitial();  
                
                // Victory sound
                Sound.loadMenuSound();
                
                // Menu is now different
                Menu.configureWinner();
                
                // Reset all indexes to all levels
                Persistence.resetLevelIndexes();
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
    admobid: null,

    init: function() {
        
        if(window.AdMob) {
            
            if( /(android)/i.test(navigator.userAgent) ) {
                this.admobid = {
                    banner: properties['bannerIdAndroid'],
                    interstitial: properties['interstitialIdAndroid']
                };
            } else if(/(ipod|iphone|ipad)/i.test(navigator.userAgent)) {
                this.admobid = {
                    banner: properties['bannerIdIos'],
                    interstitial: properties['interstitialIdIos']
                };
            }
            
            AdMob.setOptions(properties.adOptions);
 
            AdMob.prepareInterstitial({adId: this.admobid.interstitial});
            
            this.showBanner();
        }
    },
    
    showBanner: function() {
        
        if(window.AdMob && !this.bannerVisible && this.admobid != null) {
            
           AdMob.createBanner({
                adId : this.admobid.banner,
                position : AdMob.AD_POSITION.BOTTOM_CENTER,
                autoShow : true,
                overlap: true
            });
            
            this.bannerVisible = true;
        }
    },
    
    hideBanner: function() {
        if(window.AdMob && this.bannerVisible && this.admobid != null) {
            AdMob.removeBanner();
            this.bannerVisible = false;
        }
    },
    
    showInterstitial: function() {
        if(window.AdMob && this.admobid != null)
            AdMob.showInterstitial();
    }
};

var Sound = {

    media: {
        menu: {player: null, isPlaying: 0, loop: 1},
        level: {player: null, isPlaying: 0, loop: 1},
        correct: {player: null, isPlaying: 0, loop: 0},
        win: {player: null,isPlaying: 0, loop: 0},
        lose: {player: null, isPlaying: 0, loop: 0},
        click: {player: null, isPlaying: 0, loop: 0}
    },

    root: null,
    muteState: null,
    levelSound: null,
    
    init: function() {
            
        var devicePath = window.location.pathname;
        this.root = devicePath.substring(0, devicePath.lastIndexOf('/')) + '/sounds/';
        
        // Fix IOS issue
        this.root = this.root.replace(/%20/g, ' ');

        this.levelSound = 0;
        this.muteState = 0;
        
        // Load sounds!
        this.loadMenuSound();
        this.loadLevelSound();
            
        this.loadAudio('correct', properties.sounds['correct']); 
        this.loadAudio('win', properties.sounds['win']); 
        this.loadAudio('lose', properties.sounds['lose']); 
        this.loadAudio('click', properties.sounds['click']);
            
        console.log('Sound module loaded!'); 
    },
    
    loadAudio: function(media, audio) {
        
        if (window.Media) {
            
            var mediaWork = this.media[media],
                stateCallback = null;

            stateCallback = function (status) {
                if (status === Media.MEDIA_STOPPED) {
                    
                    mediaWork.isPlaying = 0;
                        
                    if (mediaWork.loop)
                        Sound.play(media);
                }
            }

            mediaWork.player = new Media(this.root + audio,
                function () { 
                    console.log("Audio successfuly loaded: " + audio);                       
                },
                function (err) { console.log("Audio Error: " 
                                        + audio + ' - ' + JSON.stringify(err));},
                stateCallback
            );
        } 
    },
    
    loadMenuSound: function() {
    
        var menuSound = null;
        
        if(level > properties.maxLevel)
            menuSound = properties['sounds']['menuwin'];
        else
            menuSound = properties['sounds']['menu'];
        
        if(this.media.menu.player != null) {
            this.media.menu.player.release();
            this.media.menu.isPlaying = 0;
        }
 
        this.loadAudio('menu', menuSound); 
        
        // To solve threads race in iOS
        setTimeout(function() {
            Sound.play('menu');
        }, 300);
    },
    
    loadLevelSound: function() {
        
        var soundLevel = parseInt(level / 10);
        
        if(this.media.level.player != null) {
            this.media.level.player.release();
            this.media.level.isPlaying = 0;
        }
        
        this.levelSound = soundLevel;
        this.loadAudio('level', properties.sounds['level'].format(soundLevel));
    },
    
    play: function(media) {
        
        var workMedia = this.media[media];
        
        if(this.isMuted() && ['menu', 'level'].indexOf(media) > -1)
            return;
        
        switch(media) {
        
            case 'menu':
                this.stop('level');
            break;
                
            case 'level':
                if(parseInt(level / 10) != this.levelSound)
                    this.loadLevelSound();
                
                this.stop('menu');
                
                if(workMedia.player != null)
                    workMedia.player.seekTo(1);
            break;
                
            case 'correct': 
                this.stop('level');
                this.stop('menu');
            break;
                
            case 'win': 
                this.stop('level');
                this.stop('menu');
            break;
                
            case 'lose': 
                this.stop('level');
                this.stop('menu');
            break;
                
            case 'click':     
            break;
        }
        
        if(workMedia.player != null && !workMedia.isPlaying) {
            workMedia.player.play({ numberOfLoops: !workMedia.loop});
            workMedia.isPlaying = 1;
        }
    },
    
    stop: function(media) {
        
        var workMedia = this.media[media];
        
        if(workMedia.player != null && workMedia.isPlaying) {
            workMedia.player.pause();
            workMedia.isPlaying = 0;
        }
    },
    
    toggleMute: function() {
        
        this.muteState = !this.muteState;
        
        if(this.isMuted()) {

            for(var i in this.media)
                this.stop(i);
            
        } else {
             this.play('menu');            
        } 
    },
    
    isMuted: function() {
        return this.muteState;
    }
};

var Persistence = {
    
    retrieveStars: function() {
        
        console.log('Retrieving stars from local storage...');

        var storedStars = localStorage.getItem('stars');

        if(storedStars === null || storedStars.length === 0)
            storedStars = 0;

        return parseInt(storedStars);
    },
    
    updateStars: function(n) {
        
        console.log('Updating stars, adding {0}'.format(n));

        // Default is add 1 to level
        var stars = this.retrieveStars();

        localStorage.setItem('stars', stars + n);     
    },    
    
    retrieveLevelIndex: function() {
        
        console.log('Retrieving level index from local storage to level {0}...'.
                    format(level));
        
        var storedLevelIndex = localStorage.getItem(level);
        
        if(storedLevelIndex === null || storedLevelIndex.length === 0 
           || storedLevelIndex > properties.maxLevelIndex)
            storedLevelIndex = 1;
        
        levelIndex = storedLevelIndex;
        
        console.log('Retrieved level index {0} from local storage to level {1}.'.
                    format(storedLevelIndex, level));
        
        return storedLevelIndex;
    },
    
    updateLevelIndex: function() {
        
        console.log('Updating level index from level {0}...'.format(level));
        
        // Goes from 1 to max, then becomes 1 again...
        levelIndex = (levelIndex % properties.maxLevelIndex) + 1;
        
        localStorage.setItem(level, levelIndex);
        
        console.log('Saving level index {0} to level {1}...'.format(levelIndex, level));
    },
    
    resetLevelIndexes: function() {
        
        console.log('Reseting all level indexes to all {0} levels...'
                    .format(properties.maxLevel));
        
        for(i = 1; i <= properties.maxLevel; i++) {
             localStorage.setItem(i, 1);
            console.log('Level {0} ... Index: {1}'.format(i, 1));
        }
        
        console.log('All indexes reseted!');
    },

    updateLevel: function(newLevel) {
    
        console.log('Updating level {0} to {1}'.format
                    (level, newLevel ? newLevel : level+1));

        // Default is add 1 to level
        level = newLevel ? newLevel : level + 1;

        console.log('Saving level {0} to local storage'.format(level));

        localStorage.setItem('level', level);
    },
    
    retrievePlayerLevel: function() {

        console.log('Retrieving level from local storage...');

        var storedLevel = localStorage.getItem('level');

        if(storedLevel === null || storedLevel.length === 0)
            storedLevel = properties['startingLevel'];

        this.updateLevel(parseInt(storedLevel)); 

        console.log('Retrieved level {0} from local storage.'.format(level));
    }
};

function onBackButtonPress() {
    
    console.log('Pressed back button');
    
    if(Card.status == STATUS.NEXT || Card.status == STATUS.LOSE)
        return;
    
    if (Menu.dom.instructionScreen.is(':visible')) {
        
        // Hide instructions
        Menu.dom.instructionScreen.fadeOut("fast", function() {
                       
            Menu.dom.instructionScreen.find('#pointer').css({
                top: '10%',
                left: '65%'
            });
                       
            Menu.dom.instructionScreen.find('#textual').
                html(messages['instructions.default']);
                       
            Menu.dom.instructionScreen.
                css('background-image', 'url("'+ properties.instructionsImages[0] +'")');
        });
        
    } else if (Menu.dom.creditsScreen.is(':visible')) {
        
        // Hide credits
        Menu.dom.creditsScreen.hide();
        
    } else if (Maze.dom.self.is(':visible')) {
        
        // Check if change New game to Continue
        if(level > 1 && level <= properties.maxLevel)
            Menu.dom.play.html(messages['menu.continue']);
            
        // Update status message regarding new level
        Menu.updateStatusMessage();
        
      //  Maze.dom.self.fadeOut("fast", function() {
        
            Maze.dom.self.hide();
            
            // Show menu again
            Menu.dom.self.fadeIn('fast');
            
            // Music again
            Sound.play('menu');
            
            // Show banner again (it's hidden from transition screen)
            Ads.showBanner();
     //   });
    } else 
        navigator.app.exitApp(); 
    
    Sound.play('click');
}

function preloadImages(array) {
    
    for (var i = 0; i < array.length; i++) {
        
        var img = new Image();
        
        preloadedImagesList.push(img);
        img.src = array[i];
    }
}