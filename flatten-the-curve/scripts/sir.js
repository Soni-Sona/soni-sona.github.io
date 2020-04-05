var N = 1;
var timeEnd = 180;
var initialContamination = 0.01;
var contactsPerDay = 20;
var probInfection = 0.04;
var daysInfectious = 20;
var daysImmunity = Infinity;
var mortality = 0.1;

var daysBeforeHospital = 2;
var hospitalCapacity = 0;
var mortalityHospital = 0;

var isolationStart = Infinity;
var isolationDuration = Infinity;
var contactsPerDayIsolation = 0;

var vaccineDay = Infinity;


var S_tab = null;
var I_tab = null;
var H_tab = null;
var R_tab = null;
var D_tab = null;
var t_tab = null;

// new cases per day
var nI_tab = null;
var nR_tab = null;
var nD_tab = null;

// total cases
var sI_tab = null;
var sR_tab = null;
var sD_tab = null;

var tol = 2e-3; // precision for integration
var h_max = 5;
var h_min = 1e-2;


function simulate() {
	let S = N - initialContamination;
	let I = initialContamination;
	let H = 0;
	let R = 0;
	let D = 0;
	
	S_tab = [S];
	I_tab = [I];
	H_tab = [H];
	R_tab = [R];
	D_tab = [D];
	t_tab = [0];
	
	nI_tab = [getContactsPerDay() * probInfection * I / N * S];
	nR_tab = [I * (1 - mortality) / daysInfectious];
	nD_tab = [I * mortality / daysInfectious];
	
	sI_tab = [nI_tab[0]];
	sR_tab = [nR_tab[0]];
	// sD_tab = [nD_tab[0]];
	
	let t = 0;
	let h = 1;
	
	let vaccine_given = false;
	
	while (t < timeEnd) {
		let y = [S, I, H, R, D];
		let k1 = derivative(t,  y);
		let k2 = derivative(t + h, array_sum(y, array_mul(k1, h)));
		
		// estimate error
		let err = array_sum(array_mul(k1, -0.5), array_mul(k2, 0.5));
		let err_max = err.reduce((max, curr) => Math.max(max, Math.abs(curr)));
		// scale h to match error to tolerance
		// h = Math.max(h_min, Math.min(h_max, h * Math.pow(tol / err_max, 1 / err_order)));
		h = Math.max(h_min, Math.min(h_max, h * tol / err_max)); // err_order = 1
		if (t + h > timeEnd) h = timeEnd - t;
		
		// compute next step
		k2 = derivative(t + h, array_sum(y, array_mul(k1, h)));
		dy_dh = array_sum(array_mul(k1, 0.5), array_mul(k2, 0.5));
		[S, I, H, R, D] = array_sum(y, array_mul(dy_dh, h));
		
		if (!vaccine_given && t > vaccineDay) {
			R += S;
			S = 0;
			vaccine_given = true;
		}
		// I = Math.max(I, 0);
		D = N - S - I - H - R;
		t += h;
		
		S_tab.push(S);
		I_tab.push(I);
		H_tab.push(H);
		R_tab.push(R);
		D_tab.push(D);
		t_tab.push(t);
		
		nI_tab.push(getContactsPerDay(t) * probInfection * I / N * S);
		nR_tab.push((I * (1 - mortality) + H * (1 - mortalityHospital)) / daysInfectious);
		nD_tab.push((I * mortality + H * mortalityHospital) / daysInfectious);
		
		sI_tab.push(sI_tab[sI_tab.length - 1] + h * nI_tab[nI_tab.length - 1]);
		sR_tab.push(sR_tab[sR_tab.length - 1] + h * nR_tab[nR_tab.length - 1]);
		// sD_tab.push(sD_tab[sD_tab.length - 1] + h * nD_tab[nD_tab.length - 1]);
	}
	
	sD_tab = D_tab;
	
	// console.log(`${t_tab.length} points generated`);
}

function derivative(t, y) {
	let [S, I, H, R, D] = y;
	
	let S_to_I = getContactsPerDay(t) * probInfection * I / N * S;
	let I_to_R = I / daysInfectious * (1 - mortality);
	let I_to_D = I / daysInfectious * mortality;
	let I_to_H = I * (1 - 1 / daysInfectious) / daysBeforeHospital;
	let H_to_R = H / daysInfectious * (1 - mortalityHospital);
	let H_to_D = H / daysInfectious * mortalityHospital;
	let R_to_S = R / daysImmunity;
	
	I_to_H = Math.min(hospitalCapacity - H + H_to_R + H_to_D, I_to_H);
	
	let dS = R_to_S - S_to_I;
	let dI = S_to_I - I_to_H - I_to_R - I_to_D;
	let dH = I_to_H - H_to_R - H_to_D;
	let dR = I_to_R + H_to_R - R_to_S;
	let dD = I_to_D + H_to_D;
	
	return [dS, dI, dH, dR, dD];
}

function getContactsPerDay(t) {
	return (t >= isolationStart && t < isolationStart + isolationDuration) ? contactsPerDayIsolation : contactsPerDay;
}

function array_sum(a, b) {
	let c = [];
	for (let i in a) {
		c.push(a[i] + b[i]);
	}
	return c;
}

function array_mul(a, m) {
	let b = [];
	for (let i in a) {
		b.push(a[i] * m);
	}
	return b;
}