# Use a lightweight Python base image
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install the Python dependencies
# The --no-cache-dir flag is used to prevent pip from storing cache data,
# which reduces the image size.
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code into the container
COPY . .

# Expose the port that Uvicorn will run on
EXPOSE 8000

# Start the application using Uvicorn
# The --host 0.0.0.0 is needed for the server to be accessible from outside the container
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]