class Solution {
    public int[] solution(int[] numbers) {
        int[] answer = new int [numbers.length];
        
        for(int i = 0; i < numbers.length; i++) {
            int c = 2;
            c *= numbers[i];
            answer[i] = c;
        }
        
        
        return answer;
    }
}