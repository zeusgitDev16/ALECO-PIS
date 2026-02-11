import React from 'react';
import './CSS/BodyLandPage.css';


function InterruptionList() {

    const interruptions = [
        {
            id: 1,
            type: "Unscheduled",
            status: "Ongoing",
            affectedAreas: ["Legazpi City", "Daraga"],
            feeder: "Feeder 5",
            cause: "Line fault due to heavy rains",
            dateTimeStart: "2023-10-27 14:00",
            dateTimeEndEstimated: "2023-10-27 18:00",
            dateTimeRestored: null
        },
        {
            id: 2,
            type: "Scheduled",
            status: "Pending",
            affectedAreas: ["Tabaco City"],
            feeder: "Feeder 1",
            cause: "Maintenance of substation",
            dateTimeStart: "2023-10-28 08:00",
            dateTimeEndEstimated: "2023-10-28 17:00",
            dateTimeRestored: null
        },
        {
            id: 3,
            type: "Unscheduled",
            status: "Restored",
            affectedAreas: ["Guinobatan"],
            feeder: "Feeder 3",
            cause: "Tripped line",
            dateTimeStart: "2023-10-26 10:00",
            dateTimeEndEstimated: null,
            dateTimeRestored: "2023-10-26 11:30"
        }
    ];

    return (
        <div className="interruption-list">
            <h2>Power Interruption Updates (Brownout)</h2>
            {interruptions.map((item) => (
                <div key={item.id} className="interruption-card" style={{border: '1px solid #ccc', margin: '10px', padding: '10px', borderRadius: '5px'}}>
                    <h3 style={{color: item.status === 'Ongoing' ? 'red' : item.status === 'Pending' ? 'orange' : 'green'}}>
                        {item.status} - {item.type}
                    </h3>
                    <p><strong>Feeder:</strong> {item.feeder}</p>
                    <p><strong>Affected Areas:</strong> {item.affectedAreas.join(", ")}</p>
                    <p><strong>Cause:</strong> {item.cause}</p>
                    <p><strong>Start:</strong> {item.dateTimeStart}</p>
                    {item.dateTimeEndEstimated && <p><strong>Estimated Restoration:</strong> {item.dateTimeEndEstimated}</p>}
                    {item.dateTimeRestored && <p><strong>Restored:</strong> {item.dateTimeRestored}</p>}
                </div>
            ))}
        </div>
    );
}

export default InterruptionList