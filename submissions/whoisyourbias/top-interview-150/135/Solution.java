import java.util.*;

class Solution {
	public int candy(int[] ratings) {
		int[] candies = new int[ratings.length];
		Arrays.fill(candies, 1);

		// ratings: 1 2 3 2 1
		// candies: 1 1 1 1 1
		

		// ratings: 1 2 3 2 1
		// 좌 < 우 먼저 판정
		// candies: 1 2 3 1 1
		for (int i = 1; i < ratings.length; i++) {
			if (ratings[i-1] < ratings[i]) {
				candies[i] = candies[i-1] + 1;
			}
		}

		// ratings: 1 2 3 2 1
		// 좌 > 우 판정
		// candies: 1 2 3 2 1
		for (int i = ratings.length - 2; i >= 0; i--) {
			if (ratings[i] > ratings[i + 1]) {
				if (candies[i] <= candies[i + 1]) {
					candies[i] = candies[i + 1] + 1;
				}
			}
		}

        int sum = 0;
        for (int i = 0; i < candies.length; i++){
            sum+=candies[i];
        }
        return sum;
	}
}

