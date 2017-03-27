/**
 * @module Diagnostics
 */
/// <reference path="./diagnosticsPlugin.ts"/>
/// <reference path="./diagnosticHelpers.ts"/>
module Diagnostics {

    _module.controller( "Diagnostics.HeapController", ["$scope", "$window", "$location", "localStorage", "workspace", "jolokia", ( $scope, $window, $location, localStorage: WindowLocalStorage, workspace, jolokia ) => {

        Diagnostics.configureScope( $scope, $location, workspace );
        $scope.classHistogram = '';
        $scope.status = '';
        $scope.tableDef = tableDef();
        $scope.classes = [{ num: 0, count: 0, bytes: 0, name: 'Click reload to read class histogram' }];
        $scope.loading = false;
        $scope.lastLoaded = 'n/a';
        $scope.pid = findMyPid($scope.pageTitle);


        $scope.loadClassStats = () => {
            $scope.loading = true;
            Core.$apply( $scope );
            jolokia.request( {
                type: 'exec',
                mbean: 'com.sun.management:type=DiagnosticCommand',
                operation: 'gcClassHistogram([Ljava.lang.String;)',
                arguments: ['']
            }, {
                    success: render,
                    error: ( response ) => {
                        $scope.status = 'Could not get class histogram : ' + response.error;
                        $scope.loading = false;
                        Core.$apply( $scope );
                    }
                });
        };


        function render( response ) {
            $scope.classHistogram = response.value;
            var lines = response.value.split( '\n' );
            var parsed = [];
            var classCounts = {};
            var bytesCounts = {};
            for ( var i = 0; i < lines.length; i++ ) {
                var values = lines[i].match( /\s*(\d+):\s*(\d+)\s*(\d+)\s*(\S+)\s*/ );
                if ( values && values.length >= 5 ) {
                    var className = translateJniName( values[4] );
                    var count = values[2];
                    var bytes = values[3];
                    var entry = {
                        num: values[1],
                        count: count,
                        bytes: bytes,
                        name: className,
                        deltaCount: findDelta( $scope.instanceCounts, className, count ),
                        deltaBytes: findDelta( $scope.byteCounts, className, bytes )
                    };

                    parsed.push( entry );
                    classCounts[className] = count;
                    bytesCounts[className] = bytes;
                }
            }
            $scope.classes = parsed;
            $scope.instanceCounts = classCounts;
            $scope.byteCounts = bytesCounts;
            $scope.loading = false;
            $scope.lastLoaded = Date.now();
            Core.$apply( $scope );
        }

        function findDelta( oldCounts, className, newValue ) {
            if ( !oldCounts ) {
                return '';
            }
            var oldValue = oldCounts[className];
            if ( oldValue ) {
                return oldValue - newValue;
            } else {
                return newValue;
            }
        }

        function numberColumnTemplate( field ) {
            return '<div class="rightAlignedNumber ngCellText" title="{{row.entity.' + field + '}}">{{row.entity.' + field + '}}</div>';
        }

        function tableDef() {
            return {
                selectedItems: [],
                data: 'classes',
                showFilter: true,
                filterOptions: {
                    filterText: ''
                },
                showSelectionCheckbox: false,
                enableRowClickSelection: true,
                multiSelect: false,
                primaryKeyFn: function( entity, idx ) {
                    return entity.num;
                },
                columnDefs: [
                    {
                        field: 'num',
                        displayName: '#',
                    }, {
                        field: 'count',
                        displayName: 'Instances',
                        cellTemplate: numberColumnTemplate('count')
                    }, {
                        field: 'deltaCount',
                        displayName: '>delta',
                        cellTemplate: numberColumnTemplate('deltaCount')
                    }, {
                        field: 'bytes',
                        displayName: 'Bytes',
                        cellTemplate: numberColumnTemplate('bytes')
                    }, {
                        field: 'deltaBytes',
                        displayName: '>delta',
                        cellTemplate: numberColumnTemplate('deltaBytes')
                    }, {
                        field: 'name',
                        displayName: 'Class name'
                    }]
            };

        }

        function translateJniName( name ) {
            if ( name.length == 1 ) {
                switch ( name.charAt( 0 ) ) {
                    case 'I':
                        return 'int';
                    case 'S':
                        return 'short';
                    case 'C':
                        return 'char';
                    case 'Z':
                        return 'boolean';
                    case 'D':
                        return 'double';
                    case 'F':
                        return 'float';
                    case 'J':
                        return 'long';
                    case 'B':
                        return 'byte';
                }
            } else {
                switch ( name.charAt( 0 ) ) {
                    case '[':
                        return translateJniName( name.substring( 1 ) ) + '[]';
                    case 'L':
                        return translateJniName( name.substring( 1, name.indexOf( ';' ) ) );
                    default:
                        return name;
                }
            }

        }

    }] );

}
