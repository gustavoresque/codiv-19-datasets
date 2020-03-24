const fs = require("fs");

const csvFilePathBed='./leitos/leitos.csv';
const csvFilePathPop='./dataset_pop.csv';
const csvFilePath='./covid_19_data.csv';
const csv=require('csvtojson');


csv({delimiter:","})
.fromFile(csvFilePath)
.then((jsonObj)=>{

	//Obtem todas as datas presentes na base.
	let array_datas = jsonObj.map(value => value["ObservationDate"]);
	//Torna elas únicas
	let datas_unicas = [...new Set(array_datas)];

	//Obtem todos os países
	let paises = jsonObj.map(value => value["Country/Region"]);
	//Torna eles únicos
	let paises_unicos = [...new Set(paises)];


	//será o novo array de dados processados
	let new_data = [];
	for(let i =0; i <datas_unicas.length; i++){
		for(let j =0; j <paises_unicos.length; j++){
			
			let newInstance = {date: datas_unicas[i], country: paises_unicos[j]};
			let countConfirmed = 0, countDeaths=0, countRecovered=0, countLastConfirmed=0;
			for(let k =0; k <jsonObj.length; k++){
				if(jsonObj[k]["ObservationDate"] === datas_unicas[i] && jsonObj[k]["Country/Region"] === paises_unicos[j]){
					countConfirmed +=  +jsonObj[k]["Confirmed"];
					countDeaths += +jsonObj[k]["Deaths"];
					countRecovered += +jsonObj[k]["Recovered"];
				}else if(i>0 && jsonObj[k]["ObservationDate"] === datas_unicas[i-1] && jsonObj[k]["Country/Region"] === paises_unicos[j]){
					countLastConfirmed += +jsonObj[k]["Confirmed"];
				}
			}
			newInstance.confirmed = countConfirmed;
			newInstance.deaths = countDeaths;
			newInstance.recovered = countRecovered;
			newInstance.active = newInstance.confirmed-newInstance.deaths-newInstance.recovered;
			newInstance.death_rate = newInstance.confirmed > 0 ? newInstance.deaths/newInstance.confirmed : 0;
			newInstance.recovery_rate = newInstance.confirmed > 0 ? newInstance.recovered/newInstance.confirmed : 0;
			newInstance._lastconfirmed = countLastConfirmed;
			growth_aux = newInstance.confirmed/newInstance._lastconfirmed;
			newInstance.growth_rate = i>0?(isNaN(growth_aux)|| !isFinite(growth_aux) ? 0:growth_aux):0;
			

			new_data.push(newInstance);
		}
		
	}


	//Realiza o cruzamento dos dados sobre o covid-19 com a população mundial em 2018 (última atualização).
	csv({delimiter:","})
	.fromFile(csvFilePathPop)
	.then((jsonObjPop)=>{
		let changeName = {
			"United States": "US",
			// "China": "Mainland China", 
			"Hong Kong SAR, China": "Hong Kong",
			"Macao SAR, China": "Macau",
			"Korea, Rep.":"Korea, South",
			//"United Kingdom": "UK", 
			"Russian Federation": "Russia",
			"Egypt, Arab Rep.": "Egypt",
			"Iran, Islamic Rep.":"Iran",
			"Slovak Republic": "Slovakia"

		};
		for(let i =0; i <jsonObjPop.length; i++){
			for(let j =0; j <new_data.length; j++){
				let nomeAjustado = changeName[jsonObjPop[i]['Country Name']] ? changeName[jsonObjPop[i]['Country Name']]: jsonObjPop[i]['Country Name'];
				if(nomeAjustado === new_data[j].country){
					new_data[j].popcount = +jsonObjPop[i]["2018"];
				}
			}
		}

		for(let j =0; j <new_data.length; j++){
			if(new_data[j].popcount){
				new_data[j].confirmed_per_1M = new_data[j].confirmed * 1000000 / new_data[j].popcount;
				new_data[j].deaths_per_1M = new_data[j].deaths * 1000000 / new_data[j].popcount;
				new_data[j].recovered_per_1M = new_data[j].recovered * 1000000 / new_data[j].popcount;
				new_data[j].active_per_1M = new_data[j].active * 1000000 / new_data[j].popcount;
				// new_data[j]._lastconfirmed_per_1M = new_data[j]._lastconfirmed * 1000000 / new_data[j].popcount;
				// new_data[j].growth_rate_per_1M = new_data[j].confirmed_per_1M/new_data[j]._lastconfirmed_per_1M;
			}
		}

		//filtra países que ainda não tiveram 100 casos confirmados.
		console.log("datalength before filter: "+new_data.length);
		let paises = [], ultima_data = datas_unicas[datas_unicas.length-1];
		for(let j =0; j <new_data.length; j++){
			if(new_data[j].date === ultima_data && new_data[j].confirmed < 100){
				paises.push(new_data[j].country);
			}
		}
		for(let j =0; j <new_data.length; j++){
			if(paises.indexOf(new_data[j].country)>=0){
				new_data.splice(j, 1);
			}
		}
		console.log("datalength after filter: "+new_data.length);
		//console.log("filtered coutries: ", paises);
		


		csv({delimiter:","})
			.fromFile(csvFilePathBed)
			.then((jsonObjBed)=>{
				objCruzado = {};
				for(let i =0; i <jsonObjPop.length; i++){
					for(let j =0; j <jsonObjBed.length; j++){
						let code = jsonObjPop[i]["Country Code"];
						if(code === jsonObjBed[j]["LOCATION"]){
							objCruzado[code] = {
								beds: Math.round((jsonObjBed[j]["Value"]/1000)*(+jsonObjPop[i]["2018"])),
								country: changeName[jsonObjPop[i]['Country Name']] ? changeName[jsonObjPop[i]['Country Name']]: jsonObjPop[i]['Country Name']
							}
							break;
						}
					}
				}
				for(let code in objCruzado){
					//console.log(objCruzado[code].beds, objCruzado[code].country);
					for(let j =0; j <new_data.length; j++){
						if(new_data[j].country === objCruzado[code].country){
							new_data[j].confirmed_per_bed = new_data[j].confirmed/objCruzado[code].beds;
							new_data[j].active_per_bed = new_data[j].active/objCruzado[code].beds;
						}
					}
				}
				// console.log(new_data);
				fs.writeFile("covid_19_data.json",JSON.stringify(new_data),"utf-8",(err)=>{
					if(err)
						throw err;
					console.log("data Saved!");
				})

			});



		

	});

});