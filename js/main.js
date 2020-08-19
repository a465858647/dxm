window.onload = function () {
	var viewer = initViewer();
	$('#searchBtn').on('click', function () {
		searchFromGeoserver(viewer, 'http://localhost:8008/geoserver/dxm/wfs', 'xzq_shi', 'XZQCODE', $('#codeTxt').val(), false);
	});
	$('#searchBtn2').on('click', function () {
		console.log(viewer);
		searchFromGeoserver(viewer, 'http://localhost:8008/geoserver/dxm/wfs', 'xzq_shi', 'XZQNAME', $('#codeTxt2').val(), true);
	});
	$('#searchBtn3').on('click', function () {
		var projectName = $('#projectName').val();
		var projectValue = $('#projectValue').val();
		var projectClass = $('#projectClass').val();
		var projectPositionX = $('#projectPositionX').val();
		var projectPositionY = $('#projectPositionY').val();
		var percentageComplete = 0.9;
		addProjectLabel(viewer, projectName, projectValue, projectClass, projectPositionX, projectPositionY, percentageComplete);
	});
	$('#zhandianBtn').on('click', function () {
		var coordinates = $('#coordinates').val();
		drawPoint(coordinates);
	});
	$('#catchPointBtn').on('click', function () {
		var newPoint;
		catchPoint(viewer, 'darwPoint', newPoint, function (newPoint) {
			console.log(newPoint);
		});
	});
	$('#addPointDXMBtn').on('click', function () {
		var url = 'http://127.0.0.1:8008/geoserver/dxm/wfs';
		var layername = 'dxm:dxm_point';
		// var fieldValues = { code: 999, fclass: 'ceshi', flag: 1, ID: 299 };
    var fieldValues = {};
    fieldValues.ID = prompt('ID:');
		fieldValues.code = prompt('code:');
		fieldValues.fclass = prompt('fclass:');
		fieldValues.flag = prompt('flag:');
		addPointOnline(viewer, url, layername, fieldValues, false);
	});
	$('#updatePointDXMBtn').on('click', function () {
		var url = 'http://127.0.0.1:8008/geoserver/dxm/wfs';
		var layername = 'dxm:dxm_point';
		updatePointOnline(viewer, url, layername /* , fieldValues */);
	});
	$('#removePointDXMBtn').on('click', function () {
		var url = 'http://127.0.0.1:8008/geoserver/dxm/wfs';
		var layername = 'dxm:dxm_point';
		removeOnline(viewer, url, layername);
	});
	$('#addPLDXMBtn').on('click', function () {
		var url = 'http://127.0.0.1:8008/geoserver/dxm/wfs';
		var layername = 'dxm:dxm_line';
		var fieldValues = {};
		fieldValues.ID = prompt('id:');
		fieldValues.Name = prompt('Name:');
		addPLOnline(viewer, url, layername, fieldValues);
	});
	$('#deletePLDXMBtn').on('click', function () {
		var url = 'http://127.0.0.1:8008/geoserver/dxm/wfs';
		var layername = 'dxm:dxm_line';
		removeOnline(viewer, url, layername);
	});
	$('#editPLDXMBtn').on('click', function () {
		var url = 'http://127.0.0.1:8008/geoserver/dxm/wfs';
		var layername = 'dxm:dxm_line';
		editPLOnline(viewer, url, layername);
	});
	$('#editPropertyDXMBtn').on('click', function () {
		var url = 'http://127.0.0.1:8008/geoserver/dxm/wfs';
		var layername = 'dxm:dxm_point';
		clickForProperties(viewer, url, layername, function (ID, data) {
			for (var p in data) {
				var fieldValue = prompt('请输入' + p + '值：', data[p]);
				setPropertyByID(viewer, url, layername, ID, p, fieldValue);
			}
		});
	});
	$('#addToExitPLDXMBtn').on('click', function () {
		var url = 'http://127.0.0.1:8008/geoserver/dxm/wfs';
		var layername = 'dxm:dxm_line';
		addToExitPlOnLine(viewer, url, layername);
	});
	$('#addPolygonDXMBtn').on('click', function () {
		var url = 'http://127.0.0.1:8008/geoserver/dxm/wfs';
		var layername = 'dxm:dxm_polygon';
		var fieldValues = { ID: '991', Name: 'ceshi' };
		addPolygonOnline(viewer, url, layername, fieldValues);
	});
	$('#removePolygonDXMBtn').on('click', function () {
		var url = 'http://127.0.0.1:8008/geoserver/dxm/wfs';
		var layername = 'dxm:dxm_polygon';
		removeOnline(viewer, url, layername);
	});
	$('#addHoleInPolygonDXMBtn').on('click', function () {
		var url = 'http://127.0.0.1:8008/geoserver/dxm/wfs';
		var layername = 'dxm:dxm_polygon';
		addHoleInPolygonOnline(viewer, url, layername);
	});
	$('#editPolygonDXMBtn').on('click', function () {
		var url = 'http://127.0.0.1:8008/geoserver/dxm/wfs';
		var layername = 'dxm:dxm_polygon';
		editPolygonOnline(viewer, url, layername);
	});
	$('#ceshiBtn').on('click', function () {});
	$('#addToExitPolygonDXMBtn').on('click', function () {
		var url = 'http://127.0.0.1:8008/geoserver/dxm/wfs';
		var layername = 'dxm:dxm_polygon';
		addToExitPolygon(viewer, url, layername);
	});
};
