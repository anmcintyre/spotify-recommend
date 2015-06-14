var unirest = require('unirest');
var express = require('express');
var events = require('events');
var app = express();
app.use(express.static('public'));

var getFromApi = function (endpoint, args) {
	var emitter = new events.EventEmitter();
	unirest.get('https://api.spotify.com/v1/' + endpoint)
	.qs(args)
	.end(function (response) {
		emitter.emit('end', response.body);
	});
	return emitter;
};

app.get('/search/:name', function (req, res) {
	var searchReq = getFromApi('search', {
			q : req.params.name,
			limit : 1,
			type : 'artist'
		});

	searchReq.on('end', function (item) {
		var artist = item.artists.items[0];

		//make request using artist.id to get related artists
		getFromApi("artists/" + artist.id + "/related-artists", {})
      .on('end', function (relatedArtists) {
        artist.related = relatedArtists.artists;

        var completed = 0;
      
        var checkCompleted = function (res, artist) {
          if (completed === relatedArtists.artists.length) {
            res.json(artist);
          }
        }

        artist.related.forEach(function (relatedArtist) {
          //make request to get related artist's tracks
          getFromApi("artists/" + relatedArtist.id + "/top-tracks", {country: "US"})
            .on('end', function (topTracks) {
              relatedArtist.tracks = topTracks.tracks;
              completed += 1;
              checkCompleted(res, artist);
            })
            .on('error', function () {
              completed += 1;
              console.log("could not retrieve tracks for an artist");
            });
        })

      })
      .on('error', function () {
        console.log("could not retrieve related artists");
      });
	});

	searchReq.on('error', function () {
		res.sendStatus(404);
	});
});

app.listen(8080);