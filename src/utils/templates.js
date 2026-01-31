export const studentProfileHTML = (student) => {
  // Logic for occupancy type
  const occupancyType =
    student.room_id?.occupied_count === 1 ? "Single"
      : student.room_id?.occupied_count === 2 ? "Double"
        : student.room_id?.occupied_count === 3 ? "Triple"
          : "Not Assigned";

  // Date formatting helper
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  // Image Logic: Use student image or a default placeholder
  const studentPhoto = student?.profile_photo || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Hostel Verification Record</title>
  <style>
    @page { margin: 20px; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #333;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      background-color: #fff;
      padding: 20px;
    }

    /* Header Styles */
    .header {
      display: flex;
      align-items: center;
      border-bottom: 2px solid #800000;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo-container {
      flex: 0 0 100px;
      margin-right: 20px;
    }
    .logo-container img {
      width: 100px;
      height: auto;
      object-fit: contain;
    }
    .header-text {
      flex: 1;
    }
    .college-name {
      font-size: 24px;
      font-weight: bold;
      color: #800000;
      margin: 0;
      text-transform: uppercase;
    }
    .doc-title {
      font-size: 18px;
      font-weight: 600;
      color: #555;
      margin: 5px 0 0 0;
    }

    /* Section Styles */
    .section {
      margin-bottom: 25px;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      overflow: hidden;
    }
    .section-title {
      background-color: #f4f4f4;
      padding: 8px 15px;
      font-weight: bold;
      color: #333;
      border-bottom: 1px solid #e0e0e0;
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Profile Container (Photo + Info) */
    .profile-container {
      display: flex;
      padding: 15px;
      gap: 20px;
    }
    .photo-box {
      flex: 0 0 120px; /* Fixed width for photo */
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    .student-photo {
      width: 120px;
      height: 150px;
      object-fit: cover;
      border: 1px solid #ccc;
      border-radius: 4px;
      background-color: #f9f9f9;
    }
    
    /* Grid for Data */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr; /* Two columns */
      gap: 15px;
      flex: 1; /* Take remaining width */
    }
    .info-grid-full {
      /* For sections without photo */
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      padding: 15px;
    }
    
    .field-group {
      display: flex;
      flex-direction: column;
    }
    .label {
      font-size: 12px;
      color: #666;
      margin-bottom: 2px;
      font-weight: 600;
    }
    .value {
      font-size: 14px;
      color: #000;
      font-weight: 500;
      border-bottom: 1px dashed #ccc;
      padding-bottom: 2px;
    }

    /* Signature Section */
    .footer {
      margin-top: 50px;
      display: flex;
      justify-content: space-between;
      padding: 0 20px;
    }
    .signature-box {
      text-align: center;
      width: 200px;
    }
    .sign-line {
      border-top: 1px solid #333;
      margin-bottom: 5px;
      width: 100%;
    }
    .sign-label {
      font-size: 13px;
      font-weight: bold;
    }

    /* Print Optimizations */
    @media print {
      body { padding: 0; }
      .section { break-inside: avoid; }
    }
  </style>
</head>

<body>

  <div class="header">
    <div class="logo-container">
      <img src="https://pec.ac.in/sites/default/files/pec_centenary_logo.jpg" alt="PEC Logo" />
    </div>
    <div class="header-text">
      <div class="college-name">Punjab Engineering College</div>
      <div class="doc-title">Hostel Student Verification Record</div>
      <div style="font-size: 12px; color: #777; margin-top: 4px;">(Deemed to be University), Chandigarh</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Personal Information</div>
    <div class="profile-container">
      
      <div class="photo-box">
        <img src="${studentPhoto}" alt="Student Photo" class="student-photo" />
      </div>

      <div class="info-grid">
        <div class="field-group">
          <span class="label">Full Name</span>
          <span class="value">${student.user_id.full_name || '-'}</span>
        </div>
        <div class="field-group">
          <span class="label">Student ID (SID)</span>
          <span class="value">${student.sid || '-'}</span>
        </div>
        <div class="field-group">
          <span class="label">Email Address</span>
          <span class="value">${student.user_id.email || '-'}</span>
        </div>
        <div class="field-group">
          <span class="label">Phone Number</span>
          <span class="value">${student.user_id.phone || '-'}</span>
        </div>
        <div class="field-group">
          <span class="label">Branch / Stream</span>
          <span class="value">${student.branch || '-'}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Guardian & Address Details</div>
    <div class="info-grid-full">
      <div class="field-group">
        <span class="label">Guardian Name</span>
        <span class="value">${student.guardian_name || '-'}</span>
      </div>
      <div class="field-group">
        <span class="label">Guardian Contact</span>
        <span class="value">${student.guardian_contact || '-'}</span>
      </div>
      <div class="field-group" style="grid-column: span 2;">
        <span class="label">Permanent Address</span>
        <span class="value">${student.permanent_address || '-'}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Hostel Allocation</div>
    <div class="info-grid-full">
      <div class="field-group">
        <span class="label">Block & Room</span>
        <span class="value">${student.room_id?.block || "N/A"} - ${student.room_id?.room_number || "N/A"}</span>
      </div>
      <div class="field-group">
        <span class="label">Room Occupancy</span>
        <span class="value">${occupancyType}</span>
      </div>
      <div class="field-group">
        <span class="label">Allotment Status</span>
        <span class="value" style="color: ${student.allotment_status === 'Allocated' ? 'green' : 'red'}; font-weight:bold;">
          ${student.allotment_status || '-'}
        </span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Office Verification</div>
    <div class="info-grid-full">
      <div class="field-group">
        <span class="label">Verification Status</span>
        <span class="value">${student.verification_status || 'Pending'}</span>
      </div>
      <div class="field-group">
        <span class="label">Date Verified</span>
        <span class="value">${formatDate(student.updatedAt)}</span>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="signature-box">
      <div style="height: 40px;"></div>
      <div class="sign-line"></div>
      <div class="sign-label">Student Signature</div>
    </div>
    <div class="signature-box">
      <div style="height: 40px;"></div>
      <div class="sign-line"></div>
      <div class="sign-label">Hostel Authority / Warden</div>
    </div>
  </div>

</body>
</html>
  `;
};