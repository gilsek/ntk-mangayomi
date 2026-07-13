function chapterRow({ episodeId, displayNumber, workId = "60079", title }) {
  return `<li class="list-item" data-index="${displayNumber}">
    <div class="wr-num">${displayNumber}</div>
    <div class="wr-subject">
      <a href="/novel/${workId}/${episodeId}" class="item-subject">${title ?? `${displayNumber}화`}</a>
    </div>
    <div class="wr-date hidden-xs">2026.07.14</div>
  </li>`;
}

function largeHtml(count = 10000, mutateRow) {
  const rows = Array.from({ length: count }, (_, index) => {
    const row = {
      episodeId: String(900000 - index),
      displayNumber: 20000 - index * 2,
      workId: "60079",
    };
    return chapterRow(mutateRow ? mutateRow(row, index) : row);
  }).join("");
  return `<form id="serial-move"><div class="serial-list"><ul class="list-body">${rows}</ul></div></form>`;
}

module.exports = { chapterRow, largeHtml };
