from flask import Flask, render_template, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
import json
import uuid
import random
import os

app = Flask(__name__)
app.secret_key = os.urandom(24)

# SQLite URI
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Load income_profiles, recidivism_profiles, income_analysis, and recidivism_analysis data from JSON files
with open('data/income_with_meta.json') as f:
    income_profiles = json.load(f)

with open('data/recidivism_with_meta.json') as f:
    recidivism_profiles = json.load(f)

with open('data/income_analysis.json') as f:
    income_analysis = json.load(f)

with open('data/recidivism_analysis.json') as f:
    recidivism_analysis = json.load(f)


# Define the database models
class UserSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(120), unique=True, nullable=False)
    assigned_task = db.Column(db.String(120))


class ExperimentData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(120), nullable=False)
    experiment_number = db.Column(db.Integer)
    selected_profile_index = db.Column(db.Integer)
    chat_history = db.Column(db.Text)
    user_prediction = db.Column(db.String(120))
    chat_iterations = db.Column(db.Integer)


# Create the database tables
with app.app_context():
    db.create_all()


@app.route('/')
def home():
    return 'Welcome to the server!'


@app.route('/consent')
def consent():
    session_id = str(uuid.uuid4())
    tasks = ['income', 'recidivism']
    assigned_task = random.choice(tasks)

    # Store the session ID and assigned task in the session
    session['session_id'] = session_id
    session['assigned_task'] = assigned_task

    return render_template('consent.html', session_id=session_id, assigned_task=assigned_task)


@app.route('/instruction', methods=['GET', 'POST'])
def instructions():
    if request.method == 'POST':
        session_id = session.get('session_id')
        assigned_task = session.get('assigned_task')
        return render_template('instruction.html', session_id=session_id, assigned_task=assigned_task)
    else:
        return "Invalid request method. Please submit the consent form."


@app.route('/experiment/<int:experiment_number>', methods=['GET', 'POST'])
def experiment(experiment_number):
    session_id = session.get('session_id')
    assigned_task = session.get('assigned_task')
    return render_template('experiment.html', session_id=session_id, experiment_number=experiment_number,
                           assigned_task=assigned_task)


@app.route('/experiment_data', methods=['POST'])
def post_experiment_data():
    data = request.get_json()
    session_id = data.get('sessionId')
    experiment_number = data.get('experimentNumber')
    selected_profile_index = data.get('selectedProfileIndex')
    chat_history = json.dumps(data.get('chatHistory'))
    user_prediction = data.get('userPrediction')
    chat_iterations = data.get('chatIterations')

    # Assuming you want to save this data to the database
    experiment_data = ExperimentData(
        session_id=session_id,
        experiment_number=experiment_number,
        selected_profile_index=selected_profile_index,
        chat_history=chat_history,
        user_prediction=user_prediction,
        chat_iterations=chat_iterations
    )
    db.session.add(experiment_data)
    db.session.commit()

    return jsonify({'message': 'Experiment data received'})


@app.route('/thanks')
def thanks():
    session_id = request.args.get('session_id')
    return render_template('thanks.html', session_id=session_id)


@app.route('/experiment', methods=['POST'])
def experiment_data():
    data = request.get_json()
    # Process the experiment data here (e.g., save to a database)
    print('Received experiment data:', data)
    return jsonify({'message': 'Experiment data received'})


@app.route('/data/income_profiles')
def get_income_profiles():
    return jsonify(income_profiles)


@app.route('/data/recidivism_profiles')
def get_recidivism_profiles():
    return jsonify(recidivism_profiles)


@app.route('/data/income_analysis')
def get_income_analysis():
    return jsonify(income_analysis)


@app.route('/data/recidivism_analysis')
def get_recidivism_analysis():
    return jsonify(recidivism_analysis)


if __name__ == '__main__':
    app.run(debug=True)
