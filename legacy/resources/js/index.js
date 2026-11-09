var typed = new Typed('.typing', {
  strings: ["an Android app programmer", "a backend engineer", "a frontend engineer", "a fullstack enginner"],
  typeSpeed: 50,
  backSpeed: 50,
  loop: true,
  showCursor: false
});


var colors = {
  'pink': '#E1499A',
  'yellow': '#f0ff08',
  'green': '#47e495'
};



var formatPercent = d3.format('.0%');
var twoPi = Math.PI * 2;

var initProgressOne = function () {
  var radius = 100;
  var border = 5;
  var padding = 30;
  var startPercent = 0;
  var endPercent = 0.85;
  var boxSize = (radius + padding) * 2;
  var color = colors.green;

  var count = Math.abs((endPercent - startPercent) / 0.01);
  var step = endPercent < startPercent ? -0.01 : 0.01;

  var parent = d3.select('div#progressOne');

  var arc = d3.svg.arc()
    .startAngle(0)
    .innerRadius(radius)
    .outerRadius(radius - border);

  var svg = parent.append('svg')
    .attr('width', boxSize)
    .attr('height', boxSize);

  var defs = svg.append('defs');

  var filter = defs.append('filter')
    .attr('id', 'blur');

  filter.append('feGaussianBlur')
    .attr('in', 'SourceGraphic')
    .attr('stdDeviation', '7');

  var g = svg.append('g')
    .attr('transform', 'translate(' + boxSize / 2 + ',' + boxSize / 2 + ')');

  var meter = g.append('g')
    .attr('class', 'progress-meter');

  meter.append('path')
    .attr('class', 'background')
    .attr('fill', '#ccc')
    .attr('fill-opacity', 0.5)
    .attr('d', arc.endAngle(twoPi));

  var foreground = meter.append('path')
    .attr('class', 'foreground')
    .attr('fill', color)
    .attr('fill-opacity', 1)
    .attr('stroke', color)
    .attr('stroke-width', 5)
    .attr('stroke-opacity', 1)
    .attr('filter', 'url(#blur)');

  var front = meter.append('path')
    .attr('class', 'foreground')
    .attr('fill', color)
    .attr('fill-opacity', 1);

  var numberText = meter.append('text')
    .attr('fill', '#fff')
    .attr('text-anchor', 'middle')
    .attr('dy', '.35em');

  foreground.attr('d', arc.endAngle(twoPi * endPercent));
  front.attr('d', arc.endAngle(twoPi * endPercent));
  numberText.text(formatPercent(endPercent));
};

var initProgressTwo = function () {
  var radius = 100;
  var border = 5;
  var padding = 30;
  var startPercent = 0;
  var endPercent = 0.65;
  var boxSize = (radius + padding) * 2;
  var color = colors.pink;

  var count = Math.abs((endPercent - startPercent) / 0.01);
  var step = endPercent < startPercent ? -0.01 : 0.01;

  var parent = d3.select('div#progressTwo');

  var arc = d3.svg.arc()
    .startAngle(0)
    .innerRadius(radius)
    .outerRadius(radius - border);

  var svg = parent.append('svg')
    .attr('width', boxSize)
    .attr('height', boxSize);

  var defs = svg.append('defs');

  var filter = defs.append('filter')
    .attr('id', 'blur');

  filter.append('feGaussianBlur')
    .attr('in', 'SourceGraphic')
    .attr('stdDeviation', '7');

  var g = svg.append('g')
    .attr('transform', 'translate(' + boxSize / 2 + ',' + boxSize / 2 + ')');

  var meter = g.append('g')
    .attr('class', 'progress-meter');

  meter.append('path')
    .attr('class', 'background')
    .attr('fill', '#ccc')
    .attr('fill-opacity', 0.5)
    .attr('d', arc.endAngle(twoPi));

  var foreground = meter.append('path')
    .attr('class', 'foreground')
    .attr('fill', color)
    .attr('fill-opacity', 1)
    .attr('stroke', color)
    .attr('stroke-width', 5)
    .attr('stroke-opacity', 1)
    .attr('filter', 'url(#blur)');

  var front = meter.append('path')
    .attr('class', 'foreground')
    .attr('fill', color)
    .attr('fill-opacity', 1);

  var numberText = meter.append('text')
    .attr('fill', '#fff')
    .attr('text-anchor', 'middle')
    .attr('dy', '.35em');

  foreground.attr('d', arc.endAngle(twoPi * endPercent));
  front.attr('d', arc.endAngle(twoPi * endPercent));
  numberText.text(formatPercent(endPercent));
};

var initProgressThree = function () {
  var radius = 100;
  var border = 5;
  var padding = 30;
  var startPercent = 0;
  var endPercent = 0.35;
  var boxSize = (radius + padding) * 2;
  var color = colors.yellow;

  var count = Math.abs((endPercent - startPercent) / 0.01);
  var step = endPercent < startPercent ? -0.01 : 0.01;

  var parent = d3.select('div#progressThree');

  var arc = d3.svg.arc()
    .startAngle(0)
    .innerRadius(radius)
    .outerRadius(radius - border);

  var svg = parent.append('svg')
    .attr('width', boxSize)
    .attr('height', boxSize);

  var defs = svg.append('defs');

  var filter = defs.append('filter')
    .attr('id', 'blur');

  filter.append('feGaussianBlur')
    .attr('in', 'SourceGraphic')
    .attr('stdDeviation', '7');

  var g = svg.append('g')
    .attr('transform', 'translate(' + boxSize / 2 + ',' + boxSize / 2 + ')');

  var meter = g.append('g')
    .attr('class', 'progress-meter');

  meter.append('path')
    .attr('class', 'background')
    .attr('fill', '#ccc')
    .attr('fill-opacity', 0.5)
    .attr('d', arc.endAngle(twoPi));

  var foreground = meter.append('path')
    .attr('class', 'foreground')
    .attr('fill', color)
    .attr('fill-opacity', 1)
    .attr('stroke', color)
    .attr('stroke-width', 5)
    .attr('stroke-opacity', 1)
    .attr('filter', 'url(#blur)');

  var front = meter.append('path')
    .attr('class', 'foreground')
    .attr('fill', color)
    .attr('fill-opacity', 1);

  var numberText = meter.append('text')
    .attr('fill', '#fff')
    .attr('text-anchor', 'middle')
    .attr('dy', '.35em');

  foreground.attr('d', arc.endAngle(twoPi * endPercent));
  front.attr('d', arc.endAngle(twoPi * endPercent));
  numberText.text(formatPercent(endPercent));
};

initProgressOne();
initProgressTwo();
initProgressThree();
