'use strict';

//other elements
const deleteAll = document.querySelector('.deleteAll');
const warning = document.querySelector('.warning');
const cancelDelete = document.querySelector('.cancelDeleteAll');
const confimrDelete = document.querySelector('.confirmDeleteAll');
const beginInstructions = document.querySelector('.begin-instructions');
const closeBeginBtn = document.querySelector('.close-instructions');

//add form elements
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type-add');
const inputDistance = document.querySelector('.form__input--distance-add');
const inputDuration = document.querySelector('.form__input--duration-add');
const inputCadence = document.querySelector('.form__input--cadence-add');
const inputElevation = document.querySelector('.form__input--elevation-add');
const cancel = document.querySelector('.cancel');

//edit form elements
const sidebar = document.querySelector('.sidebar');
const editForm = document.querySelector('.edit-form');
const editInputType = document.querySelector('.form__input--type-edit');
const editInputDistance = document.querySelector('.form__input--distance-edit');
const editInputDuration = document.querySelector('.form__input--duration-edit');
const editInputCadence = document.querySelector('.form__input--cadence-edit');
const editInputElevation = document.querySelector('.form__input--elevation-edit');
const deleteBtn = document.querySelector('.delete-btn');

let map, mapEvent;

class Workout{
    date = new Date();
    id = Date.now().toString().slice(-10);
    clicks = 0;

    constructor(coords, distance, duration, pathCoords = null) {
        this.coords = coords;
        this.distance = distance;
        this.duration = duration;
        this.pathCoords = pathCoords;
    }

    setDescription() {

        // prettier-ignore
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
    }

    click () {
        this.clicks++;
    }

}

class Running extends Workout {
    type = 'running';
    constructor(coords, distance, duration, cadence) {
        super(coords, distance, duration);
        this.cadence = cadence;
        this.calcPace();
        this.setDescription();
        this.speed = -Infinity;         //this data only added for sorting purposes
        this.elevationGain = -Infinity; //this data only added for sorting purposes
    }

    calcPace() {
        //min/km
        this.pace = this.duration/ this.distance;
    }
}

class Cycling extends Workout {
    type = 'cycling';
    constructor(coords, distance, duration, elevationGain) {
        super(coords, distance, duration);
        this.elevationGain = elevationGain;
        this.calcSpeed();
        this.setDescription();
        this.pace = Infinity;    //this data only added for sorting purposes
        this.cadence = Infinity; //this data only added for sorting purposes
    }

    calcSpeed() {
        //km/hr
        this.speed = this.distance/(this.duration);
    }
}

class App{
    #map;
    #mapEvent;
    #markers = [];
    #paths = [];
    #workouts = [];
    #mapZoomLevel = 13;
    #curEdit;         //holds a copy of currently edited workout obj
    #curPath;
    #editing = false; //boolean, is set to true if currently editing
    #adding = false; //boolean, flags if form is currently shown
    #drawing = false; //boolean flag indicates if currently drawing
    #sortDistanceAscend = false; //boolean flags, indicate whether to sort data ascend or descend
    #sortDurationAscend = false;
    #tempPopup;
    #curWorkoutDistance = 0;
    #sortPaceAscend = false;
    #sortSpeedAscend = false;
    #sortElevationGainAscend = false;
    #sortCadenceAscend = false;
    #pathCoords = [];

    constructor() {
        //get user position
        this._getPosition();

        //get data from local storage
        this._getLocalStorage();

        //prepare the begin instructions to close after 7s
        this._autoCloseBeginInstructions();

        //add Event Listeners
        closeBeginBtn.addEventListener('click', this._removeHelpMenu);
        cancel.addEventListener('click', this._cancelAdd.bind(this));
        form.addEventListener('submit', this._newWorkout.bind(this));
        deleteAll.addEventListener('click', this._toggleWarning);
        cancelDelete.addEventListener('click', this._toggleWarning);
        confimrDelete.addEventListener('click', this._deleteAllWorkouts.bind(this));
        editForm.addEventListener('submit', this._editWorkout.bind(this));
        deleteBtn.addEventListener('click', this._deleteWorkout.bind(this));
        inputType.addEventListener('change', this._toggleElevationField);
        editInputType.addEventListener('change', this._toggleElevationField); 
        containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
        sidebar.addEventListener('click', this._showEditForm.bind(this));
        sidebar.addEventListener('click', this._sortWorkouts.bind(this));  
    }   
    
    _removeHelpMenu() {
        if(beginInstructions.classList.contains('hidden')) return;
        beginInstructions.classList.add('hidden');
    }

    _editWorkout(e) {
        
        e.preventDefault();
        
        //get data from edit Form
        const type = editInputType.value;
        const distance = +editInputDistance.value; 
        const duration = +editInputDuration.value;
        let cadence;
        let elevation;
        let editedWorkout;

        //check for running
        if(type === 'running'){
            cadence = +editInputCadence.value;

            //validate data
            if(!this.allValid(distance, duration, cadence) || !this.allPositive(distance, duration, cadence)){ 
                return alert('Inputs have to be positive numbers!');
            }
        
            //edit run type workout
            editedWorkout = new Running(this.#curEdit.coords, distance, duration, cadence);
            
            //update id of edited workout in state
            editedWorkout.id = this.#curEdit.id;
            
            //update marker on map
            this._updateMarker(editedWorkout); 
        }
        
        //check for cycling
        if(type === 'cycling') {
            elevation = +editInputElevation.value;

            //validate data
            if(!this.allValid(distance, duration, elevation) || !this.allPositive(distance, duration)){ 
                return alert('Inputs have to be positive numbers!');
            }

            //edit cycling type workout
            editedWorkout = new Cycling(this.#curEdit.coords, distance, duration, elevation);
            
            //update of of edited workout
            editedWorkout.id = this.#curEdit.id;

            //update marker on map
            this._updateMarker(editedWorkout); 
        }

        //remove previous workouts from DOM
        const workouts = document.querySelectorAll('.workout');
        workouts.forEach(cur => cur.remove());

        //repaint workouts, including the updated edit
        this.#workouts.forEach(cur => this._renderWorkout(cur));

        //reset all input fields
        editInputDistance.value = editInputDuration.value = editInputCadence.value = editInputElevation.value = '';

        //remove highlight on edited workout
        this._updateEditBorder(null);

        //hide editForm element
        editForm.classList.add('hidden');

        //save changes to local storage
        this._setLocalStorage();

        //flag as finished editing
        this.#editing = false;
    }

    _cancelAdd(e) {
        //remove all data on map for canceled workout
        this.#map.removeLayer(this.#tempPopup);
        if(this.#curPath)
            this.#map.removeLayer(this.#curPath);

        //clear all data that's created to add new workout
        this.#curPath = null;
        this.#tempPopup = null;
        this.#pathCoords = [];

        //clear all form data
        inputCadence.value = inputDistance.value = inputDuration.value = inputElevation.value = inputCadence.value = "";

        //close add form
        form.classList.add('hidden');

        //set adding and drawing to false
        this.#adding = false;
        this.#drawing = false;
    }

    //function to close the begining instructions after 7 seconds
    _autoCloseBeginInstructions() {
        setTimeout(() => {
            this._removeHelpMenu();
        }, 7000);
    }

    _updateMarker(editedWorkout) {
        this.#workouts.forEach((cur, index) => {
            if(cur.id === editedWorkout.id)
            {   
                //replace workout in memory 
                this.#workouts[index] = editedWorkout;

                //remove the old marker and popup
                this._removeMarkerByCoord(...this.#workouts[index].coords);

                //render new marker and popup
                this._renderWorkoutMarker(this.#workouts[index]);
            }
        });
    }

    _getPosition() {
        if(navigator.geolocation){
            navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), 
                function(err){
                    alert('Could not get your position');
                }
            );
        }
    }

    _addDistanceAllPts() {
        let pathDistance = 0;
        if(this.#pathCoords.length <= 1) return 0;
        else{
            for(let i = 1; i< this.#pathCoords.length; i++){
                pathDistance += this._distance2pts(this.#pathCoords[i-1], this.#pathCoords[i]);
            }
        }
        return pathDistance;
    }

    //return teh distance between two points given in lat and long
    _distance2pts (pt1, pt2) {
        let p = 0.017453292519943295;    // Math.PI / 180
        let c = Math.cos;
        let a = 0.5 - c((pt2[0] - pt1[0]) * p)/2 + 
                c(pt1[0] * p) * c(pt2[0] * p) * 
                (1 - c((pt2[1] - pt1[1]) * p))/2;
        
        return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
    }

    _loadMap(position) {
            const {latitude} = position.coords;
            const {longitude} = position.coords;

            const coords = [latitude, longitude];

            this.#map = L.map('map').setView(coords, 13);

            L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.#map);

            //handling clicks on map
            this.#map.on('click', this._mapClickHandler.bind(this));

            //load from local storage, marker and paths
            this.#workouts.forEach( work => {
                this._renderWorkoutMarker(work);
                this._renderPath(work); 
            });
            
        }

    _mapClickHandler(mapE) {
        //add a temp popup
        if(!this.#drawing){
        const { lat, lng } = mapE.latlng;
        this.#tempPopup = (L.marker([lat, lng])
            .addTo(this.#map)
            .bindPopup(
                L.popup({
                    maxWidth: 250,
                    minWidth: 100,
                    autoClose: false,
                    closeOnClick: false,
                    /* className: `${workout.type}-popup` */
                })
            )
            .setPopupContent(`Enter workout data and submit, or click map again to trace your workout path to auto calculate distance.`)
            .openPopup()); 
        }

        //remove close begining instructions
        this._removeHelpMenu();

        //handle drawing
        if(this.#drawing){
            this._drawPath(mapE);
            inputDistance.value = this._addDistanceAllPts().toFixed(1);
        }

        //show the form if not currently addin or editing
        if(this.#editing === false || this.#adding === false){
            this.#mapEvent = mapE;
            const {lat, lng} = mapE.latlng;
            this.#pathCoords.push([lat, lng]);
            this.#drawing = true;
            form.classList.remove('hidden');
            inputDistance.focus();
            this.#adding = true;
        }else{
            alert('Finish editing before adding a new workout...');
        }
    }

    _updateEditBorder(elmnt) {
        //disable all borders
        document.querySelectorAll('.workout').forEach( cur => {
            cur.classList.remove('curEdit');
        }); 
        
        if(elmnt){
            //add last clicked border
            elmnt.classList.add('curEdit');
        }
    }

    _showEditForm(e) {

        const workoutEl = e.target.closest('.edit-btn'); 

        if(!workoutEl) return;

        e.preventDefault();

        //block from adding and editing simultaneously
        if(this.#adding) return alert('Finish adding workout before editing any current workout');

        //add border to correct workout on DOM to identify currently editing workout 
        const curWorkout = e.target.parentNode.parentNode;        
        this._updateEditBorder(curWorkout);

        //toggle the edit form
        editForm.classList.remove('hidden');
        editInputDistance.focus(); 

        //retrieve workout Info to edit
        let workOutId = e.target.parentNode.parentNode.dataset.id;
        this.#curEdit = this.#workouts.find(cur => cur.id === workOutId); 
        
        //autofill the form with previous values
        editInputDistance.value = this.#curEdit.distance;
        editInputDuration.value = this.#curEdit.duration;
        editInputType.value = this.#curEdit.type;
        if(this.#curEdit.type === 'cycling'){
            editInputElevation.value = this.#curEdit.elevationGain;
        }else {
            editInputCadence.value = this.#curEdit.cadence;
        }

        //update the elevation field
        this._updateEditElevationField(editInputType.value);
        
        //set editing flag to true
        this.#editing = true;
    }

    _hideEditForm() {
        //hide class
        editForm.style.display = 'none';
        editForm.classList.add('hidden');
        setTimeout(() => {
            editForm.style.display = 'grid';
        }, 1000);
        
        //set editing to false
        this.#editing = false;
    }

    _hideForm() {
        //empty inputs 
        inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';
        
        //hide class
        form.style.display = 'none';
        form.classList.add('hidden');
        setTimeout(() => {
            form.style.display = 'grid';
        }, 1000);
    }

    _toggleElevationField (e) {
        //for adding form
        if(e.target.closest('.form')){
            inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
            inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
        }
        //for editing form
        if(e.target.closest('.edit-form')) {
            editInputElevation.closest('.form__row').classList.toggle('form__row--hidden');
            editInputCadence.closest('.form__row').classList.toggle('form__row--hidden');
        }
    }

    //same as toggleElevationField, no event necessary for this version
    _updateEditElevationField(type) {
        //reset both field
        if(type === 'running') {
            editInputCadence.closest('.form__row').classList.remove('form__row--hidden');
            editInputElevation.closest('.form__row').classList.add('form__row--hidden');
        }
        if(type === 'cycling') {
            editInputCadence.closest('.form__row').classList.add('form__row--hidden');
            editInputElevation.closest('.form__row').classList.remove('form__row--hidden');
        }
    }

    //input validation functions
    allValid = (...inputs) => inputs.every(inp => Number.isFinite(inp));
    allPositive = (...inputs) => inputs.every(inp => inp > 0);

    _newWorkout (e) {        
        e.preventDefault();

        //get data from form
        const type = inputType.value;
        const distance = +inputDistance.value; 
        const duration = +inputDuration.value;
        const [lat, lng ] = this.#pathCoords[0];

        let workout;
        
        //check for running
        if(type === 'running'){
        
            const cadence = +inputCadence.value;

            //validate data
            if(!this.allValid(distance, duration, cadence) || !this.allPositive(distance, duration, cadence)){ 
                return alert('Inputs have to be positive numbers!');
            }

            workout = new Running([lat, lng], distance, duration, cadence);
        }
        
        //check for cycling
        if(type === 'cycling') {
            const elevation = +inputElevation.value;

            //validate data
            if(!this.allValid(distance, duration, elevation) || !this.allPositive(distance, duration)){ 
                return alert('Inputs have to be positive numbers!');
            }

            workout = new Cycling([lat, lng], distance, duration, elevation);
        }

        //add new object to workout array
        this.#workouts.push(workout);

        //render workout starting point mark
        this._renderWorkoutMarker(workout);

        //render workout on list
        this._renderWorkout(workout);

        //clear input field and hide form
        this._hideForm();

        //check if delete all btn needs to be hidden or not
        this._toggleDeleteAllBtn();
        
        //flag as finished adding
        this.#adding = false;

        //flag as finished drawing
        this.#drawing = false;
        
        //store path coords in current adding object
        this.#workouts[this.#workouts.length-1].pathCoords = this.#pathCoords;

        //add curent path to array
        this.#paths.push(this.#curPath);

        //reset path coords
        this.#pathCoords = [];
        
        //reset cur editing drawn path
        this.#curPath = null;

        //set local storage
        this._setLocalStorage();

        //delete temp popup
        this.#map.removeLayer(this.#tempPopup);
    }

    _sortWorkouts(e){

        //only trigger if not currently editing or adding
        if(this.#editing || this.#adding) return;

        //don't interfere with edit-btn function
        if(e.target.className === 'edit-btn') return;
        
        //remove old workout display on the dom
        const workouts = document.querySelectorAll('.workout');
        workouts.forEach(cur => {
            cur.remove();
        });

        ////sort this.#workouts array by field
        if(e.target.classList.contains('distance')){
            //update sortDistanceAscend flag
            this.#sortDistanceAscend = !this.#sortDistanceAscend;
            //sort ascending or descending
            if(this.#sortDistanceAscend)
                this.#workouts.sort((a,b) => a.distance - b.distance);
            else
                this.#workouts.sort((a,b) => b.distance - a.distance);
        } else if(e.target.classList.contains('duration')){
            //update sortDurationAscend flag
            this.#sortDurationAscend = !this.#sortDurationAscend;
            //sort ascending or descending
            if(this.#sortDurationAscend)
                this.#workouts.sort((a,b) => a.duration - b.duration);
            else
                this.#workouts.sort((a,b) => b.duration - a.duration);
        } else if(e.target.classList.contains('pace')){
            //update sortPaceAscend flag
            this.#sortPaceAscend = !this.#sortPaceAscend;
            //sort ascending or descending
            if(this.#sortPaceAscend)
                this.#workouts.sort((a,b) => a.pace - b.pace);
            else
                this.#workouts.sort((a,b) => b.pace - a.pace);
        } else if(e.target.classList.contains('speed')){
            //update sortSpeedAscend flag
            this.#sortSpeedAscend = !this.#sortSpeedAscend;
            //sort ascending or descending
            if(this.#sortSpeedAscend)
                this.#workouts.sort((a,b) => a.speed - b.speed);
            else
                this.#workouts.sort((a,b) => b.speed - a.speed);
        } else if(e.target.classList.contains('elevationGain')){
            //update sortElevationGainAscend flag
            this.#sortElevationGainAscend = !this.#sortElevationGainAscend;
            //sort ascending or descending
            if(this.#sortElevationGainAscend)
                this.#workouts.sort((a,b) => a.elevationGain - b.elevationGain);
            else
                this.#workouts.sort((a,b) => b.elevationGain - a.elevationGain);
        } else if(e.target.classList.contains('cadence')){
            //update sortCadenceAscend flag
            this.#sortCadenceAscend = !this.#sortCadenceAscend;
            //sort ascending or descending
            if(this.#sortCadenceAscend)
                this.#workouts.sort((a,b) => a.cadence - b.cadence);
            else
                this.#workouts.sort((a,b) => b.cadence - a.cadence);
        }
        
        //repaint new order onto dom
        this.#workouts.forEach( work => {
            this._renderWorkout(work);
        });
    }

    _drawPath(mapE) {
        //get current map even click coordiantes
        if(mapE.latlng){
            let {lat, lng} = mapE.latlng;
            this.#pathCoords.push([lat, lng]);
        }
        //if no current path, create one
        if(this.#curPath === undefined || this.#curPath === null){
            this.#curPath = L.polyline(this.#pathCoords, {color: 'red'}).addTo(this.#map);
        //otherwise, just add coords to current path
        } else{
            this.#curPath.setLatLngs(this.#pathCoords);
        }
    }

    //render path on map
    _renderPath(workout) {
        if(!workout.pathCoords) return; 
        let latlngs = workout.pathCoords;
        this.#paths.push(L.polyline(latlngs, {color: 'red'}).addTo(this.#map));
    } 

    //render workout marker
    _renderWorkoutMarker(workout) {
        this.#markers.push(L.marker(workout.coords)
            .addTo(this.#map)
            .bindPopup(
                L.popup({
                    maxWidth: 250,
                    minWidth: 100,
                    autoClose: false,
                    closeOnClick: false,
                    className: `${workout.type}-popup`
                })
            )
            .setPopupContent(`${workout.type === 'running' ? '🏃‍♂️': '🚴‍♀️'} ${workout.description}`)
            .openPopup());
    }

    _toggleDeleteAllBtn() {
        if(this.#workouts.length > 0) deleteAll.classList.remove('hidden');
        else deleteAll.classList.add('hidden');
    }

    _removeMarkerByCoord(lat, long) {
        //isolate currently editing workout
        const retVal = this.#markers.filter( cur => cur._latlng.lat === lat && cur._popup._latlng.lng === long);
        
        //remove the edited marker from the list
        this.#markers = this.#markers.filter(cur => !(cur._latlng.lat === lat && cur._popup._latlng.lng === long));
        
        //remove marker from map
        this.#map.removeLayer(retVal[0]);
    }

    _removePathByCoord(lat, long){
        //isolate currently editing workout
        const retVal = this.#paths.filter( cur => cur._latlngs[0].lat === lat && cur._latlngs[0].lng === long);
        
        //remove the edited marker from the list
        this.#paths =  this.#paths.filter(cur => !(cur._latlngs[0].lat === lat && cur._latlngs[0].lng === long));
    
        //remove marker from map
        this.#map.removeLayer(retVal[0]); 
    }

    _renderWorkout(workout) {
        let html = 
        `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
            <div class="workout__title"> ${workout.description} <a href= '' class = "edit-btn"> Edit Workout </a> </div>
            <div class="workout__details">
                <span class="workout__icon distance">${workout.type === 'running' ? '🏃‍♂️': '🚴‍♀️'}</span>
                <span class="workout__value">${workout.distance}</span>
                <span class="workout__unit">km</span>
            </div>
            <div class="workout__details">
                <span class="workout__icon duration">⏱</span>
                <span class="workout__value">${workout.duration}</span>
                <span class="workout__unit">min</span>
            </div>
        `;

        if(workout.type === 'running'){
            html += 
        `
            <div class="workout__details">
            <span class="workout__icon pace">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon cadence">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>`;
        }
        if(workout.type === 'cycling'){
            html += 
            `
            <div class="workout__details">
            <span class="workout__icon speed">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon elevationGain">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>
            `;
        }

        form.insertAdjacentHTML('afterEnd', html);
    }

    _moveToPopup(e) {
        const workoutEl = e.target.closest('.workout'); 
        
        if(!workoutEl) return;

        const workout = this.#workouts.find(work => work.id === workoutEl.dataset.id);
        
        this.#map.setView(workout.coords, this.#mapZoomLevel, {
            animate: true,
            pan: {
                duration: 1,
            },
        });
    }

    _setLocalStorage() {
        localStorage.setItem('workouts', JSON.stringify(this.#workouts));
    }

    _getLocalStorage() {
        const data = JSON.parse(localStorage.getItem('workouts'));
        
        if(!data) return;
        //convert to workout objects before returning to app
        const recoveredWorkouts = data.map(cur => {
            if(cur.type === 'running'){
                let run = new Running(cur.coords, cur.distance, cur.duration, cur.cadence);
                if(cur.pathCoords)
                    run.pathCoords = cur.pathCoords;
                run.id = cur.id;
                return run;
            } else if(cur.type === 'cycling'){
                let cycle = new Cycling(cur.coords, cur.distance, cur.duration, cur.elevationGain);
                if(cur.pathCoords)
                    cycle.pathCoords = cur.pathCoords;
                cycle.id = cur.id;
                return cycle;
            }
        });

        this.#workouts = recoveredWorkouts;
        
        //workouts
        this.#workouts.forEach( work => {
            this._renderWorkout(work);
        });

        //check if delete all btn needs to be hidden or not
        this._toggleDeleteAllBtn();
    }

    //toggle warning
    _toggleWarning (e) {
        warning.classList.toggle('hidden');
    }

    //delete all workouts
    _deleteAllWorkouts(e) {
        const workouts = document.querySelectorAll('.workout');
        
        //delete markers from DOM
        workouts.forEach(cur => {
            cur.remove();
        });

        //delete all workouts from memery
        this.#workouts = [];
    
        //delete workouts markers from map
        this.#markers.forEach(cur => {
            if(cur) this.#map.removeLayer(cur);
        });

        //delete workout paths from map
            this.#paths.forEach(cur => {
                if(cur) this.#map.removeLayer(cur);
            });

        //delete markers in memeory
        this.#markers = [];

        //delete paths in memory
        this.#paths = [];

        //set local storage
        this._setLocalStorage();

        //check if delete all btn needs to be hidden or not
        this._toggleDeleteAllBtn();

        //hide edit toggle
        this._hideEditForm();

        //reset all private variables
        this._resetPrivateVariablesOnly(); 

        //hide delete all warning
        this._toggleWarning();
    }

    _deleteWorkout(e) {
       if(e.target.className === 'delete-btn'){
            //delete workout from dom
            let curEdit = document.querySelector('.curEdit');
            curEdit.remove();

            //delete workout from memory by id
            this.#workouts = this.#workouts.filter(workout => workout.id !== curEdit.dataset.id);

            //close edit form
            this._hideEditForm();

            //delete workout marker from dom and from marker list
            this._removeMarkerByCoord(...this.#curEdit.coords); 

            //delete workout path from dom and path list
            this._removePathByCoord(...this.#curEdit.coords);

            this.#curEdit = null; 

            //save data to local storage
            this._setLocalStorage();

            //check if delete all btn needs to be hidden or not
            this._toggleDeleteAllBtn();
        }   
    }

    //reset all private variables, ensure no unwanted logic occurs when deleting all workouts
    _resetPrivateVariablesOnly() {
        this.#markers = [];
        this.#workouts = [];
        this.#pathCoords = [];
        this.#paths = [];
        this.#curEdit;         //holds a copy of currently edited workout obj
        this.#editing = false; //boolean, is set to true if currently editing
        this.#adding = false; //boolean, flags if form is currently shown
        this.#sortDistanceAscend = false; //boolean flags, indicate whether to sort data ascend or descend
        this.#sortDurationAscend = false;
        this.#sortPaceAscend = false;
        this.#sortSpeedAscend = false;
        this.#sortElevationGainAscend = false;
        this.#sortCadenceAscend = false;
    }

    _resetApp () {
        localStorage.removeItem('workouts');
        location.reload();
    }
}


//run app
const app = new App();