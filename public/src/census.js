$(document).ready(function($) {

  var summaryTable = function(table, data) {
    // do gradient on score
    $(table).find('.placescore').each(function(idx, td) {
      var $td = $(td);
      var score = parseInt($td.data('score'), 10);
      $td.css('background-color', OpenDataCensus.colorScale.totalColorScale.getColor(score).hex());
    });

    $('.showpopover').each(function(idx, td) {
      var $td = $(td);
      var $tr = $td.parent();
      if (typeof data.byplace[$tr.data('place')] != 'undefined') {
        var record = data.byplace[$tr.data('place')].datasets[$td.data('dataset')];
        var datasetTitle = $td.data('datasettitle');
      }
    });

    $(table).find('thead tr th:first-child, tfoot tr th:first-child')
      .addClass('sorting')
      .html(function (idx) {
        return 'Sort' +
        '<label class="radio">' +
          '<input type="radio" name="sorttable-' + idx + '" class="sort-table" value="alpha">' +
          'alphabetically' +
        '</label>' +
        '<label class="radio">' +
          '<input type="radio" name="sorttable-' + idx + '" class="sort-table" value="score" checked>' +
          'by score' +
      '</label>';
      });

    $('.sort-table').change(function(){
      var sortBy = $(this).val();
      sortTable(table, sortBy);
    });

    $('a[data-toggle="tooltip"]').tooltip();
    $('a[data-toggle="popover"]').popover();

    // Fix widths of table cells so that when thead becomes "position: fixed;"
    // it still displays correctly
    var widths = $(table).find('thead tr:nth-child(1) > *').map(function () {
      return $(this).width();
    });
    for (var i = 0, max = widths.length; i < max; i++) {
      $(table).find('thead tr > *:nth-child(' + (i+1) + ')').width(widths[i]);
    }
  };

  var summary;

  $.getJSON('/overview.json', function(data) {
    var $table = $('.response-summary');
    summaryTable($table, data);
    // now sort
    sortTable($table, 'score');
  });

});

function sortTable(table, sortBy) {
  var sortFunc;

  var sortByPlaceName = function(a, b) {
      return $(a).data('placename').toUpperCase().localeCompare($(b).data('placename').toUpperCase());
    };

  if (sortBy === 'score') {
    // sort by score then name
    sortFunc = function(a, b) {
      var comp = parseInt($(b).data('score'), 10) - parseInt($(a).data('score'), 10);
      return comp !== 0 ? comp : sortByPlaceName(a,b);
    };
  } else {
    sortFunc = sortByPlaceName;
  }

  $('.sort-table').attr('checked', false);
  $('.sort-table[value="' + sortBy + '"]').attr('checked', true);
  table.find('tbody tr').sort(sortFunc).appendTo(table);
}
