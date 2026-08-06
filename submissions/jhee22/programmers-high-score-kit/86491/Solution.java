class Solution {
    public int solution(int[][] sizes) {
        int[][] matrix = new int[sizes.length][2];
        for (int i = 0; i < sizes.length; i++) {
            for (int j = 0; j < sizes[i].length; j++) {
                // 큰 값을 matarix[i][0] 에 몰빵하기 
                matrix[i][0] = Math.max(sizes[i][0], sizes[i][1]);
                matrix[i][1] = Math.min(sizes[i][0], sizes[i][1]);
            
            }
        }
        int max_width = Integer.MIN_VALUE; 
        int max_height = Integer.MIN_VALUE;
        for (int i = 0; i < sizes.length; i++) {
            for (int j = 0; j < sizes[i].length; j++) {
                if (matrix[i][0] >= max_width){
                    max_width = matrix[i][0];
                }
                
                 if (matrix[i][1] >= max_height){
                    max_height = matrix[i][1];
                }
            }
        }
        return max_width * max_height;
    }
}