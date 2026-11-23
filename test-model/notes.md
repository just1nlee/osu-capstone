The gesture classification model bundle contains two step neural network pipeline with a gesture embedding model followed by a gesture classification model. See more details in Gesture classification model card.

The gesture embedding model encodes the image features into a feature vector, and the classification model is a lightweight gesture classifier taking the feature vector as input. The provided gesture classification model bundle contains the canned gestures classifier, which detects the 7 common hand gestures listed earlier. 

**You can extend the model bundle to recognize more gestures by bundling your own custom gesture classifier.

