import java.util.ArrayList;
import java.util.Arrays;

class Solution {
    public int[] solution(int[] answers) {
        int[] answer = {};

		int[] scores =  new int[3];


		for (int i = 0 ; i < answers.length; i++) {
			scores[0] += scoring_1(i, answers[i]);
			scores[1] += scoring_2(i, answers[i]);
			scores[2] += scoring_3(i, answers[i]);
		}

        
		int max = Arrays.stream(scores).summaryStatistics().getMax();

		ArrayList<Integer> arr = new ArrayList<>();

		for (int i = 0 ; i < scores.length; i++) {
			if (scores[i] == max) {
				arr.add(i + 1);
			}
		}

		answer = new int[arr.size()];

		for (int i = 0; i < arr.size(); i++) {
			answer[i] = arr.get(i);
		}

        return answer;
    }

	public int scoring_1(int i, int answer) {
		if ((i +1) % 5 == 0 && answer == 5) {return 1;}
		if ((i + 1) % 5 == answer) { return 1;}
		return 0;
	}

	public int scoring_2(int i, int answer) {
		if (i % 2 == 0 && answer == 2) {return 1;}

		switch (answer) {
			case 1:
				if (i % 8 == 1)
					return 1;
                break;
			case 3:
				if (i % 8 == 3)
					return 1;
                break;
			case 4:
				if (i % 8 == 5)
					return 1;
                break;
			case 5:
				if (i % 8 == 7)
					return 1;
                break;
			default:
				return 0;
		}
        return 0;
	}

	public int scoring_3(int i, int answer) {
		switch (answer) {
            case 3:
                if (i % 10 == 0 || i % 10 == 1)
                    return 1;
                break;
            case 1:
                if (i % 10 == 2 || i % 10 == 3)
                    return 1;
                break;
            case 2:
                if (i % 10 == 4 || i % 10 == 5)
                    return 1;
                break;
            case 4:
                if (i % 10 == 6 || i % 10 == 7)
                    return 1;
                break;
            case 5:
                if (i % 10 == 8 || i% 10 == 9)
                    return 1;
                break;
            default:
                return 0;
		}
        return 0;
	}
}

