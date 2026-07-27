class Solution {
	public int solution(int[][] sizes) {
		int answer = 0;

		int widthMax = 0;
		int heightMax = 0;

		for (int[] size : sizes) {
			if (size[0] < size[1]) {
				int tmp = size[0];
				size[0] = size[1];
				size[1] = tmp;
			}

			if (size[0] > widthMax)
				widthMax = size[0];
			if (size[1] > heightMax)
				heightMax = size[1];
		}

		return widthMax * heightMax;
	}
}
