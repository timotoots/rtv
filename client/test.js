var amino = require('./node_modules/aminogfx-gl/main.js');

var gfx = new amino.AminoGfx();

gfx.start(function (err) {
    if (err) {
        console.log('Start failed: ' + err.message);
        return;
    }

    //root
    var root = this.createGroup();

    this.setRoot(root);

    //rect
    var rect = this.createRect().w(100).h(1080).fill('#FFFFFF').opacity(1.0);
    var rect2 = this.createRect().h(100).w(1920).fill('#FFFFFF').opacity(1.0);

    root.add(rect);
    root.add(rect2);

    // rect.opacity.anim().from(1.0).to(0.0).dur(1000).loop(-1).start();
    rect.x.anim().from(-100).to(1920).dur(10000).loop(30).start();
    rect2.y.anim().from(-100).to(1080).dur(10000).loop(30).start();

/*
    //text
    var text = this.createText().fill('#ff0000').opacity(1.0).x(100).y(200);

    text.text('Sample Text');
    text.opacity.anim().from(0.0).to(1.0).dur(1000).loop(-1).start();
    root.add(text);

  */

});