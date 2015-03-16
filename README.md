# jquery-dragswitch

jQuery plugin that drag switch elements

http://towry.me/jquery-dragswitch

# Usage

```javascript
$('#list1, #list2').dragswitch(function (drag) {
	drag('.item').dragEnd(function () {
		// when drag end	
	}).dragStart(function () {
		// when drag start
	}).config({
		between: true
	}).placeholder(function (p) {
	 	// p is a jquery object
	 	p.css('border-color': 'green');
	})
});
```

Or 
```javascript
$('#list1, #list2, #list3').dragswitch(function (d) {
	d(['.item_of_list1_and_list2', '.item_of_list3']);
});
```

# License

MIT License

http://towry.me/mit-license

---

Copyright 2015 by Towry Wang
